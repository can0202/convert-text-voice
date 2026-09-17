from fastapi import APIRouter
from fastapi.responses import FileResponse
import os
from core.tts_engine import detect_device

router = APIRouter()

VOICES = [
    # --- American English Female ---
    {"id": "af_heart",   "name": "Heart",   "gender": "Female", "lang": "American English"},
    {"id": "af_bella",   "name": "Bella",   "gender": "Female", "lang": "American English"},
    {"id": "af_sarah",   "name": "Sarah",   "gender": "Female", "lang": "American English"},
    # --- American English Male ---
    {"id": "am_adam",    "name": "Adam",    "gender": "Male",   "lang": "American English"},
    {"id": "am_michael", "name": "Michael", "gender": "Male",   "lang": "American English"},
    {"id": "am_echo",    "name": "Echo",    "gender": "Male",   "lang": "American English"},
    {"id": "am_eric",    "name": "Eric",    "gender": "Male",   "lang": "American English"},
    {"id": "am_liam",    "name": "Liam",    "gender": "Male",   "lang": "American English"},
    {"id": "am_onyx",    "name": "Onyx",    "gender": "Male",   "lang": "American English"},
    # --- British English Female ---
    {"id": "bf_emma",    "name": "Emma",    "gender": "Female", "lang": "British English"},
    {"id": "bf_isabella","name": "Isabella","gender": "Female", "lang": "British English"},
    # --- British English Male ---
    {"id": "bm_george",  "name": "George",  "gender": "Male",   "lang": "British English"},
    {"id": "bm_lewis",   "name": "Lewis",   "gender": "Male",   "lang": "British English"},
    {"id": "bm_daniel",  "name": "Daniel",  "gender": "Male",   "lang": "British English"},
    {"id": "bm_fable",   "name": "Fable",   "gender": "Male",   "lang": "British English"},
]

@router.get("/system-info")
def get_system_info():
    return detect_device()

@router.get("/voices")
def get_voices(lang: str = "en"):
    if lang == "en":
        return VOICES
    elif lang == "vi":
        try:
            from vieneu import Vieneu
            tts = Vieneu()
            v_list = tts.list_preset_voices()
            result = []
            for label, voice_id in v_list:
                result.append({
                    "id": voice_id,
                    "name": label,
                    "gender": "",
                    "lang": "Vietnamese"
                })
            return result
        except Exception as e:
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=f"Lỗi tải danh sách giọng tiếng Việt: {str(e)}")
    return []

@router.get("/voices/{voice_id}/preview")
def get_voice_preview(voice_id: str):
    previews_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "previews"))
    # Try MP3 first, then WAV
    for ext, media_type in [("mp3", "audio/mpeg"), ("wav", "audio/wav")]:
        preview_file = os.path.join(previews_dir, f"{voice_id}.{ext}")
        if os.path.exists(preview_file):
            return FileResponse(preview_file, media_type=media_type)
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Preview not available. Run generate_previews.py first.")
