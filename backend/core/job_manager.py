import os
import json
import uuid
import time
from typing import Dict, Any, Optional

STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage", "jobs")

def init_storage():
    """Ensure storage directory exists."""
    os.makedirs(STORAGE_DIR, exist_ok=True)

def create_job(text: str, voice: str, speed: float, device_req: str, lang: str) -> str:
    """Create a new job and return its ID."""
    init_storage()
    job_id = str(uuid.uuid4())
    job_dir = os.path.join(STORAGE_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)

    text_file = os.path.join(job_dir, "input.txt")
    with open(text_file, "w", encoding="utf-8") as f:
        f.write(text)

    state = {
        "job_id": job_id,
        "status": "queued",
        "voice": voice,
        "speed": speed,
        "device_req": device_req,
        "lang": lang,
        "created_at": time.time(),
        "updated_at": time.time(),
        "percent": 0,
        "processed_chunks": 0,
        "total_chunks": 0,
        "eta_seconds": None,
        "error": None,
        "result_file": None,
        "result_type": None,  # "mp3", "wav", or "zip"
        "srt_file": None,     # "audio.srt" when available
        "bundle_file": None   # "bundle.zip" (audio + SRT)
    }
    
    save_job_state(job_id, state)
    return job_id

def get_job_state(job_id: str) -> Optional[Dict[str, Any]]:
    """Get current state of a job."""
    state_file = os.path.join(STORAGE_DIR, job_id, "state.json")
    if not os.path.exists(state_file):
        return None
    try:
        with open(state_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None

def save_job_state(job_id: str, state: Dict[str, Any]):
    """Save state to JSON. We use atomic write to avoid corruption."""
    state["updated_at"] = time.time()
    job_dir = os.path.join(STORAGE_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)
    
    state_file = os.path.join(job_dir, "state.json")
    tmp_file = state_file + ".tmp"
    
    with open(tmp_file, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
        
    os.replace(tmp_file, state_file)

def get_job_input_text(job_id: str) -> Optional[str]:
    """Read the input text for a job."""
    text_file = os.path.join(STORAGE_DIR, job_id, "input.txt")
    if not os.path.exists(text_file):
        return None
    with open(text_file, "r", encoding="utf-8") as f:
        return f.read()

def get_job_dir(job_id: str) -> str:
    """Get the directory path for a job."""
    return os.path.join(STORAGE_DIR, job_id)
