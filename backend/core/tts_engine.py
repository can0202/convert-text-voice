import os
import re
import subprocess
import multiprocessing as mp
import time
import zipfile
from typing import List, Tuple, Dict, Any, Optional
# pyrefly: ignore [missing-import]
import numpy as np
# pyrefly: ignore [missing-import]
import soundfile as sf
# pyrefly: ignore [missing-import]
import sys

ENGINE_KOKORO = "kokoro"
ENGINE_VIENEU = "vieneu"

def get_sample_rate(engine: str) -> int:
    return 48000 if engine == ENGINE_VIENEU else 24000

PAUSE_PATTERN = re.compile(r'\[pause\s+([\d.]+)s\]', re.IGNORECASE)

# Global variables for multiprocessing workers
_pipeline = None
_voice = None
_speed = None
_engine = None


def detect_device() -> Dict[str, Any]:
    """Detect available hardware for TTS processing."""
    has_cuda = False
    gpu_name = None
    has_mps = False

    try:
        # pyrefly: ignore [missing-import]
        import torch
        if torch.cuda.is_available():
            has_cuda = True
            gpu_name = torch.cuda.get_device_name(0)
        
        # MPS (Apple Silicon) detection
        if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            has_mps = True
            if not gpu_name:
                gpu_name = "Apple Silicon GPU"
    except ImportError:
        pass
            
    return {
        "has_cuda": has_cuda,
        "has_mps": has_mps,
        "gpu_name": gpu_name,
        "cpu_cores": mp.cpu_count()
    }


def resolve_device(requested: str) -> str:
    """Resolve the actual device based on user request and hardware availability."""
    system_info = detect_device()
    
    if requested == "gpu":
        if system_info["has_cuda"]:
            return "cuda"
        elif system_info["has_mps"]:
            return "mps"
        else:
            raise ValueError("Không tìm thấy GPU khả dụng trên server, vui lòng chọn CPU hoặc Tự động.")
    
    if requested == "cpu":
        return "cpu"
        
    # Auto mode
    if system_info["has_cuda"]:
        return "cuda"
    elif system_info["has_mps"]:
        return "mps"
    return "cpu"


def split_into_chunks(text: str, max_chars: int = 400) -> List[str]:
    """Split text into smaller chunks based on sentence boundaries."""
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []

    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks, current = [], ""
    for s in sentences:
        if not s:
            continue
        if len(s) > max_chars:
            if current:
                chunks.append(current.strip())
                current = ""
            for piece in _hard_split(s, max_chars):
                chunks.append(piece)
            continue

        if len(current) + len(s) + 1 <= max_chars:
            current += (" " if current else "") + s
        else:
            chunks.append(current.strip())
            current = s
            
    if current:
        chunks.append(current.strip())
    return chunks


def prepare_segments(text: str, max_chars: int = 400) -> List[Dict[str, Any]]:
    """
    Parse text containing [pause Xs] tags into a list of processing segments.

    Each segment is a dict:
      {'type': 'text',  'content': str}   — goes through TTS
      {'type': 'pause', 'content': float} — generates silence of given duration (seconds)

    Text portions are further split into TTS-friendly chunks via split_into_chunks().
    """
    parts = PAUSE_PATTERN.split(text)   # alternating: text, pause_dur, text, pause_dur ...
    segments: List[Dict[str, Any]] = []
    for i, part in enumerate(parts):
        if i % 2 == 0:          # text portion
            stripped = part.strip()
            if stripped:
                for chunk in split_into_chunks(stripped, max_chars):
                    segments.append({'type': 'text', 'content': chunk})
        else:                   # captured pause duration
            try:
                segments.append({'type': 'pause', 'content': float(part)})
            except ValueError:
                pass
    # Fallback: if no segments were produced, treat whole text as text
    if not segments:
        for chunk in split_into_chunks(text, max_chars):
            segments.append({'type': 'text', 'content': chunk})
    return segments


def _hard_split(s: str, max_chars: int) -> List[str]:
    """Force split a long string without punctuation."""
    sub_parts = re.split(r"(?<=[,;:])\s+", s)
    result, buf = [], ""
    for p in sub_parts:
        words = p.split(" ") if len(p) > max_chars else [p]
        for w in words:
            candidate = (buf + " " + w).strip() if buf else w
            if len(candidate) <= max_chars:
                buf = candidate
            else:
                if buf:
                    result.append(buf.strip())
                    buf = ""
                if len(w) > max_chars:
                    for i in range(0, len(w), max_chars):
                        result.append(w[i:i + max_chars])
                else:
                    buf = w
    if buf:
        result.append(buf.strip())
    return [r for r in result if r]


def init_worker(engine: str, lang_code: str, voice: str, speed: float, device: str):
    """Initialize model inside each worker process."""
    global _pipeline, _voice, _speed, _engine
    _engine = engine
    _voice = voice
    _speed = speed
    
    if engine == ENGINE_VIENEU:
        # pyrefly: ignore [import-error, missing-import]
        from vieneu import Vieneu
        # Note: Vieneu doesn't use lang_code, it's specific to Vietnamese.
        _pipeline = Vieneu()
    else:
        # pyrefly: ignore [import-error, missing-import]
        from kokoro import KPipeline
        _pipeline = KPipeline(lang_code=lang_code, device=device)


def process_chunk(args: Tuple[int, str]) -> Tuple[int, np.ndarray, Optional[str]]:
    """Process a single text chunk in worker."""
    idx, chunk = args
    try:
        if _engine == ENGINE_VIENEU:
            audio = _pipeline.infer(chunk, voice=_voice)
            # Ensure it is a numpy array
            if not isinstance(audio, np.ndarray):
                audio = np.array(audio, dtype=np.float32)
            return idx, audio, None
        else:
            generator = _pipeline(chunk, voice=_voice, speed=_speed)
            parts = [audio for _, _, audio in generator]
            audio = np.concatenate(parts) if parts else np.zeros(0, dtype=np.float32)
            return idx, audio, None
    except Exception as e:
        return idx, np.zeros(0, dtype=np.float32), str(e)


def merge_to_mp3(part_paths: List[str], final_mp3_path: str) -> Optional[str]:
    """Merge wav parts to mp3 using ffmpeg."""
    from shutil import which
    ffmpeg = which("ffmpeg")
    if not ffmpeg:
        return None

    list_file = final_mp3_path + ".concat_list.txt"
    with open(list_file, "w", encoding="utf-8") as f:
        for p in part_paths:
            f.write(f"file '{os.path.abspath(p)}'\n")

    cmd = [
        ffmpeg, "-y", "-f", "concat", "-safe", "0",
        "-i", list_file, "-c:a", "libmp3lame", "-q:a", "2", final_mp3_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    os.remove(list_file)
    if result.returncode != 0:
        return None
    return final_mp3_path

def create_zip_archive(part_paths: List[str], final_zip_path: str) -> Optional[str]:
    """Create a zip file containing all wav parts."""
    try:
        with zipfile.ZipFile(final_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for p in part_paths:
                zipf.write(p, os.path.basename(p))
        return final_zip_path
    except Exception:
        return None

def run_cpu_pipeline(segments: List[Dict[str, Any]], engine: str, lang: str, voice: str, speed: float,
                     output_prefix: str, progress_callback=None, workers: int = None):
    """
    Run TTS using multiprocessing (CPU) for text segments.
    Pause segments are converted to silence arrays and interleaved with TTS results.

    Returns:
        (part_paths, errors, timings)
        timings: List of (start_sec, end_sec, chunk_text) for SRT generation.
    """
    if workers is None:
        workers = max(1, mp.cpu_count() - 1)
        
    sample_rate = get_sample_rate(engine)

    # Extract only text segments for the pool
    text_segments = [(i, s) for i, s in enumerate(segments) if s['type'] == 'text']
    text_chunks = [s['content'] for _, s in text_segments]

    if not text_chunks:
        return [], [], []

    total_chars = sum(len(c) for c in text_chunks)
    processed_chars = 0
    start_time = time.time()

    # Run pool on text chunks — imap preserves order
    indexed_text = list(enumerate(text_chunks))
    text_audio_results: List[Tuple[np.ndarray, Optional[str]]] = [None] * len(text_chunks)  # type: ignore

    with mp.Pool(
        processes=workers,
        initializer=init_worker,
        initargs=(engine, lang, voice, speed, "cpu"),
    ) as pool:
        for pool_idx, (_, audio, err) in enumerate(pool.imap(process_chunk, indexed_text, chunksize=1)):
            text_audio_results[pool_idx] = (audio, err)
            processed_chars += len(text_chunks[pool_idx])
            if progress_callback:
                progress_callback(pool_idx + 1, len(text_chunks), processed_chars, total_chars, start_time)

    # Reconstruct full sequence: interleave TTS audio with silence for pause segments
    timings: List[Tuple[float, float, str]] = []
    errors = []
    cumulative_samples = 0
    text_job_idx = 0
    all_audio_parts: List[np.ndarray] = []

    for segment in segments:
        if segment['type'] == 'pause':
            silence = np.zeros(int(segment['content'] * sample_rate), dtype=np.float32)
            all_audio_parts.append(silence)
            cumulative_samples += len(silence)
        else:
            audio, err = text_audio_results[text_job_idx]
            if err:
                errors.append((text_job_idx, err))
            start_sec = cumulative_samples / sample_rate
            cumulative_samples += len(audio)
            end_sec = cumulative_samples / sample_rate
            timings.append((start_sec, end_sec, segment['content']))
            if len(audio) > 0:
                all_audio_parts.append(audio)
            text_job_idx += 1

    if not all_audio_parts:
        return [], errors, timings

    # Write combined audio to a single WAV file
    part_path = f"{output_prefix}_part1.wav"
    full_audio = np.concatenate(all_audio_parts)
    with sf.SoundFile(part_path, mode='w', samplerate=sample_rate, channels=1, subtype='PCM_16') as f:
        f.write(full_audio)

    return [part_path], errors, timings


def run_gpu_pipeline(segments: List[Dict[str, Any]], engine: str, lang: str, voice: str, speed: float,
                     device: str, output_prefix: str, progress_callback=None):
    """
    Run TTS sequentially on GPU to avoid VRAM exhaustion.
    Pause segments are converted to silence arrays inline.

    Returns:
        (part_paths, errors, timings)
        timings: List of (start_sec, end_sec, chunk_text) for SRT generation.
    """
    sample_rate = get_sample_rate(engine)
    
    if engine == ENGINE_VIENEU:
        # pyrefly: ignore [import-error, missing-import]
        from vieneu import Vieneu
        pipeline = Vieneu()
    else:
        # pyrefly: ignore [import-error, missing-import]
        from kokoro import KPipeline
        pipeline = KPipeline(lang_code=lang, device=device)

    timings: List[Tuple[float, float, str]] = []
    errors = []
    cumulative_samples = 0
    processed_chars = 0
    text_idx = 0
    total_chars = sum(len(s['content']) for s in segments if s['type'] == 'text')
    start_time = time.time()
    total_text_segments = sum(1 for s in segments if s['type'] == 'text')

    part_path = f"{output_prefix}_part1.wav"
    with sf.SoundFile(part_path, mode='w', samplerate=sample_rate, channels=1, subtype='PCM_16') as writer:
        for segment in segments:
            if segment['type'] == 'pause':
                silence = np.zeros(int(segment['content'] * sample_rate), dtype=np.float32)
                writer.write(silence)
                cumulative_samples += len(silence)
            else:
                chunk = segment['content']
                start_sec = cumulative_samples / sample_rate
                try:
                    if engine == ENGINE_VIENEU:
                        audio = pipeline.infer(chunk, voice=voice)
                        if not isinstance(audio, np.ndarray):
                            audio = np.array(audio, dtype=np.float32)
                    else:
                        generator = pipeline(chunk, voice=voice, speed=speed)
                        parts = [audio for _, _, audio in generator]
                        audio = np.concatenate(parts) if parts else np.zeros(0, dtype=np.float32)
                    err = None
                except Exception as e:
                    audio = np.zeros(0, dtype=np.float32)
                    err = str(e)

                if err:
                    errors.append((text_idx, err))

                writer.write(audio)
                cumulative_samples += len(audio)
                end_sec = cumulative_samples / sample_rate
                timings.append((start_sec, end_sec, chunk))

                processed_chars += len(chunk)
                text_idx += 1
                if progress_callback:
                    progress_callback(text_idx, total_text_segments, processed_chars, total_chars, start_time)

    return [part_path], errors, timings

