import os
import time
import asyncio
import zipfile
# pyrefly: ignore [missing-import]
from typing import Optional
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
# pyrefly: ignore [missing-import]
from fastapi.responses import FileResponse
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
from core import job_manager, tts_engine
from core.srt_generator import generate_srt

router = APIRouter()

class JobRequest(BaseModel):
    text: str
    voice: str = "af_heart"
    lang: str = "a"
    speed: float = 1.0
    device: str = "auto"

def process_job_task(job_id: str):
    """Background task to process the TTS job."""
    state = job_manager.get_job_state(job_id)
    if not state:
        return
        
    try:
        text = job_manager.get_job_input_text(job_id)
        if not text:
            raise ValueError("Input text not found")
        
        # Parse text with [pause Xs] tags into segments
        segments = tts_engine.prepare_segments(text, max_chars=400)
        total_text_segments = sum(1 for s in segments if s['type'] == 'text')
        
        if total_text_segments == 0:
            raise ValueError("Empty text after processing")
            
        state["status"] = "processing"
        state["total_chunks"] = total_text_segments
        job_manager.save_job_state(job_id, state)
        
        job_dir = job_manager.get_job_dir(job_id)
        output_prefix = os.path.join(job_dir, "audio")
        
        # Progress callback
        last_save_time = 0
        def progress_callback(idx, total, processed_chars, total_chars, start_time):
            nonlocal last_save_time, state
            now = time.time()
            if now - last_save_time >= 1.0 or idx == total:
                elapsed = now - start_time
                rate = processed_chars / elapsed if elapsed > 0 else 0
                remaining = (total_chars - processed_chars) / rate if rate > 0 else float("nan")
                
                state["processed_chunks"] = idx
                state["percent"] = (processed_chars / total_chars) * 100
                state["eta_seconds"] = remaining
                job_manager.save_job_state(job_id, state)
                last_save_time = now

        resolved_device = tts_engine.resolve_device(state["device_req"])
        
        if resolved_device == "cpu":
            part_paths, errors, timings = tts_engine.run_cpu_pipeline(
                segments, state["lang"], state["voice"], state["speed"],
                output_prefix, progress_callback
            )
        else:
            part_paths, errors, timings = tts_engine.run_gpu_pipeline(
                segments, state["lang"], state["voice"], state["speed"],
                resolved_device, output_prefix, progress_callback
            )
            
        if not part_paths:
            raise ValueError("No audio was generated.")

        # --- Convert to MP3 or fallback to WAV ---
        final_mp3 = f"{output_prefix}.mp3"
        merged_path = tts_engine.merge_to_mp3(part_paths, final_mp3)
        
        if merged_path:
            state["result_file"] = "audio.mp3"
            state["result_type"] = "mp3"
            for p in part_paths:
                try:
                    os.remove(p)
                except:
                    pass
        else:
            # No ffmpeg — save single WAV directly
            wav_dest = os.path.join(job_dir, "audio.wav")
            if len(part_paths) == 1:
                os.rename(part_paths[0], wav_dest)
                state["result_file"] = "audio.wav"
                state["result_type"] = "wav"
            else:
                # Multiple parts (rare): zip them
                final_zip = f"{output_prefix}.zip"
                zip_path = tts_engine.create_zip_archive(part_paths, final_zip)
                if zip_path:
                    state["result_file"] = "audio.zip"
                    state["result_type"] = "zip"
                else:
                    raise ValueError("Failed to merge mp3 and failed to create zip.")

        # --- Generate SRT subtitle ---
        if timings:
            srt_content = generate_srt(timings)
            srt_path = os.path.join(job_dir, "audio.srt")
            with open(srt_path, "w", encoding="utf-8") as f:
                f.write(srt_content)
            state["srt_file"] = "audio.srt"

            # --- Create bundle.zip (audio + SRT) ---
            bundle_path = os.path.join(job_dir, "bundle.zip")
            audio_file_path = os.path.join(job_dir, state["result_file"])
            with zipfile.ZipFile(bundle_path, "w", zipfile.ZIP_DEFLATED) as zf:
                zf.write(audio_file_path, state["result_file"])
                zf.write(srt_path, "audio.srt")
            state["bundle_file"] = "bundle.zip"

        state["status"] = "completed"
        if errors:
            state["error"] = f"Hoàn thành nhưng có {len(errors)} đoạn bị lỗi."
            
        job_manager.save_job_state(job_id, state)

    except Exception as e:
        state = job_manager.get_job_state(job_id)
        if state:
            state["status"] = "failed"
            state["error"] = str(e)
            job_manager.save_job_state(job_id, state)


@router.post("/jobs")
def create_job(req: JobRequest, background_tasks: BackgroundTasks):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Văn bản không được để trống")
    
    # Check if GPU is explicitly requested but not available
    if req.device == "gpu":
        sys_info = tts_engine.detect_device()
        if not sys_info["has_cuda"] and not sys_info["has_mps"]:
            raise HTTPException(status_code=400, detail="Không tìm thấy GPU khả dụng trên server, vui lòng chọn CPU hoặc Tự động.")
            
    job_id = job_manager.create_job(req.text, req.voice, req.speed, req.device, req.lang)
    background_tasks.add_task(process_job_task, job_id)
    
    return {"job_id": job_id}

@router.get("/jobs/{job_id}")
def get_job_status(job_id: str):
    state = job_manager.get_job_state(job_id)
    if not state:
        raise HTTPException(status_code=404, detail="Job not found")
    return state

@router.get("/jobs/{job_id}/audio")
def get_job_audio(job_id: str):
    """Stream audio only — used by the in-page player."""
    state = job_manager.get_job_state(job_id)
    if not state or state["status"] != "completed":
        raise HTTPException(status_code=400, detail="Job is not completed yet")
        
    result_file = state.get("result_file")
    if not result_file:
        raise HTTPException(status_code=404, detail="Result file not found")
        
    file_path = os.path.join(job_manager.get_job_dir(job_id), result_file)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File has been deleted or is missing")

    result_type = state.get("result_type", "mp3")
    media_type_map = {"mp3": "audio/mpeg", "wav": "audio/wav", "zip": "application/zip"}
    return FileResponse(path=file_path, media_type=media_type_map.get(result_type, "audio/mpeg"))

@router.get("/jobs/{job_id}/download")
def download_job(job_id: str):
    """Download bundle.zip (audio + SRT). Falls back to audio-only for legacy jobs."""
    state = job_manager.get_job_state(job_id)
    if not state or state["status"] != "completed":
        raise HTTPException(status_code=400, detail="Job is not completed yet")
        
    # Prefer bundle ZIP (audio + SRT)
    bundle_file = state.get("bundle_file")
    if bundle_file:
        bundle_path = os.path.join(job_manager.get_job_dir(job_id), bundle_file)
        if os.path.exists(bundle_path):
            return FileResponse(
                path=bundle_path,
                filename="audio_with_subtitles.zip",
                media_type="application/zip"
            )

    # Fallback: audio only (old jobs without SRT)
    result_file = state.get("result_file")
    if not result_file:
        raise HTTPException(status_code=404, detail="Result file not found")
        
    file_path = os.path.join(job_manager.get_job_dir(job_id), result_file)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File has been deleted or is missing")

    result_type = state.get("result_type", "mp3")
    media_type_map = {"mp3": "audio/mpeg", "wav": "audio/wav", "zip": "application/zip"}
    return FileResponse(
        path=file_path,
        filename=result_file,
        media_type=media_type_map.get(result_type, "audio/mpeg")
    )

@router.get("/jobs/{job_id}/download-srt")
def download_srt(job_id: str):
    """Download the SRT subtitle file only."""
    state = job_manager.get_job_state(job_id)
    if not state or state["status"] != "completed":
        raise HTTPException(status_code=400, detail="Job is not completed yet")

    srt_file = state.get("srt_file")
    if not srt_file:
        raise HTTPException(status_code=404, detail="SRT file not available for this job")

    srt_path = os.path.join(job_manager.get_job_dir(job_id), srt_file)
    if not os.path.exists(srt_path):
        raise HTTPException(status_code=404, detail="SRT file not found on disk")

    return FileResponse(
        path=srt_path,
        filename="audio.srt",
        media_type="text/plain; charset=utf-8"
    )

@router.websocket("/jobs/{job_id}/progress")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    await websocket.accept()
    
    try:
        while True:
            state = job_manager.get_job_state(job_id)
            if not state:
                await websocket.send_json({"error": "Job not found"})
                break
                
            await websocket.send_json({
                "status": state["status"],
                "percent": state.get("percent", 0),
                "processed_chunks": state.get("processed_chunks", 0),
                "total_chunks": state.get("total_chunks", 0),
                "eta_seconds": state.get("eta_seconds"),
                "error": state.get("error"),
                "result_type": state.get("result_type"),
                "has_srt": state.get("srt_file") is not None,
            })
            
            if state["status"] in ["completed", "failed"]:
                break
                
            await asyncio.sleep(0.5)
            
    except WebSocketDisconnect:
        pass
