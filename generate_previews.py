import os
import sys
import numpy as np

def main():
    sys.path.append(os.path.abspath('backend'))
    # pyrefly: ignore [missing-import]
    from shutil import which
    # pyrefly: ignore [missing-import]
    import soundfile as sf

    voices = [
        # --- American English Female ---
        {'id': 'af_heart',    'name': 'Heart',    'gender': 'Female', 'lang': 'American English'},
        {'id': 'af_bella',    'name': 'Bella',    'gender': 'Female', 'lang': 'American English'},
        {'id': 'af_sarah',    'name': 'Sarah',    'gender': 'Female', 'lang': 'American English'},
        # --- American English Male ---
        {'id': 'am_adam',     'name': 'Adam',     'gender': 'Male',   'lang': 'American English'},
        {'id': 'am_michael',  'name': 'Michael',  'gender': 'Male',   'lang': 'American English'},
        {'id': 'am_echo',     'name': 'Echo',     'gender': 'Male',   'lang': 'American English'},
        {'id': 'am_eric',     'name': 'Eric',     'gender': 'Male',   'lang': 'American English'},
        {'id': 'am_liam',     'name': 'Liam',     'gender': 'Male',   'lang': 'American English'},
        {'id': 'am_onyx',     'name': 'Onyx',     'gender': 'Male',   'lang': 'American English'},
        # --- British English Female ---
        {'id': 'bf_emma',     'name': 'Emma',     'gender': 'Female', 'lang': 'British English'},
        {'id': 'bf_isabella', 'name': 'Isabella', 'gender': 'Female', 'lang': 'British English'},
        # --- British English Male ---
        {'id': 'bm_george',   'name': 'George',   'gender': 'Male',   'lang': 'British English'},
        {'id': 'bm_lewis',    'name': 'Lewis',    'gender': 'Male',   'lang': 'British English'},
        {'id': 'bm_daniel',   'name': 'Daniel',   'gender': 'Male',   'lang': 'British English'},
        {'id': 'bm_fable',    'name': 'Fable',    'gender': 'Male',   'lang': 'British English'},
    ]

    preview_dir = os.path.abspath('backend/previews')
    os.makedirs(preview_dir, exist_ok=True)

    has_ffmpeg = which('ffmpeg') is not None
    print(f"ffmpeg: {'found' if has_ffmpeg else 'NOT found - will save as WAV'}")

    # Always use CPU to avoid Windows Application Control blocking spacy/misaki GPU DLLs
    print("Using device: cpu (forced to avoid DLL policy issues on Windows)")

    SAMPLE_RATE = 24000

    # Import KPipeline directly — bypasses run_gpu_pipeline which triggers spacy DLL
    # pyrefly: ignore [import-error, missing-import]
    from kokoro import KPipeline

    # Lazily create one pipeline per lang_code to reuse across voices
    pipelines = {}

    for v in voices:
        voice_id = v['id']
        final_mp3 = os.path.join(preview_dir, f'{voice_id}.mp3')
        final_wav = os.path.join(preview_dir, f'{voice_id}.wav')

        if os.path.exists(final_mp3) or os.path.exists(final_wav):
            print(f"Skipping {voice_id} (already exists)...")
            continue

        lang_code = 'a' if 'American' in v['lang'] else 'b'
        text = f"Hi, I am {v['name']}, a {v['lang']} voice."
        print(f"Generating {voice_id} — \"{text}\"")

        if lang_code not in pipelines:
            print(f"  Loading KPipeline (lang={lang_code}, device=cpu)...")
            pipelines[lang_code] = KPipeline(lang_code=lang_code, device='cpu')

        pipeline = pipelines[lang_code]

        try:
            generator = pipeline(text, voice=voice_id, speed=1.0)
            parts = [audio for _, _, audio in generator]
            if not parts:
                print(f"  ERROR: No audio generated for {voice_id}")
                continue
            audio = np.concatenate(parts).astype(np.float32)
        except Exception as e:
            print(f"  ERROR generating {voice_id}: {e}")
            continue

        # Save as WAV first
        temp_wav = os.path.join(preview_dir, f'{voice_id}_temp.wav')
        with sf.SoundFile(temp_wav, mode='w', samplerate=SAMPLE_RATE, channels=1, subtype='PCM_16') as f:
            f.write(audio)

        if has_ffmpeg:
            import subprocess
            result = subprocess.run(
                ['ffmpeg', '-y', '-i', temp_wav, '-q:a', '2', final_mp3],
                capture_output=True
            )
            try:
                os.remove(temp_wav)
            except Exception:
                pass
            if result.returncode == 0:
                print(f"  Saved: {voice_id}.mp3")
            else:
                os.rename(temp_wav, final_wav)
                print(f"  WARNING: ffmpeg failed, saved as {voice_id}.wav")
        else:
            os.rename(temp_wav, final_wav)
            print(f"  Saved: {voice_id}.wav")

    print("\nDone! Preview files:")
    for f in sorted(os.listdir(preview_dir)):
        if f.endswith(('.mp3', '.wav')):
            size = os.path.getsize(os.path.join(preview_dir, f))
            print(f"  {f} ({size // 1024} KB)")

if __name__ == '__main__':
    import multiprocessing
    multiprocessing.freeze_support()
    main()

