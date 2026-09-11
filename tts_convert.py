#!/usr/bin/env python3
"""
tts_convert.py — Chuyển văn bản (kể cả file rất dài, hàng triệu ký tự) thành
giọng nói tiếng Anh bằng Kokoro-82M, chạy hoàn toàn trên CPU (không cần GPU).

Cách dùng cơ bản:
    python tts_convert.py --input mybook.txt --output output

Xem toàn bộ tùy chọn:
    python tts_convert.py --help
"""

import argparse
import multiprocessing as mp
import os
import re
import subprocess
import sys
import time

import numpy as np
import soundfile as sf

# ----------------------------------------------------------------------------
# Biến toàn cục cho mỗi process con (mỗi process tự load 1 bản pipeline riêng)
# ----------------------------------------------------------------------------
_pipeline = None
_voice = None
_speed = None


def init_worker(lang_code, voice, speed):
    """Chạy đúng 1 lần khi mỗi process con khởi động."""
    global _pipeline, _voice, _speed
    # Import bên trong hàm để mỗi process con tự import model riêng
    from kokoro import KPipeline
    _pipeline = KPipeline(lang_code=lang_code)
    _voice = voice
    _speed = speed


def process_chunk(args):
    """Xử lý 1 đoạn văn bản, trả về (index, audio_array, error_or_None)."""
    idx, chunk = args
    try:
        generator = _pipeline(chunk, voice=_voice, speed=_speed)
        parts = [audio for _, _, audio in generator]
        audio = np.concatenate(parts) if parts else np.zeros(0, dtype=np.float32)
        return idx, audio, None
    except Exception as e:  # noqa: BLE001 - muốn bắt mọi lỗi để không sập cả tiến trình
        return idx, np.zeros(0, dtype=np.float32), str(e)


# ----------------------------------------------------------------------------
# Chia văn bản thành các đoạn nhỏ theo câu
# ----------------------------------------------------------------------------
def split_into_chunks(text, max_chars=400):
    """Chia văn bản thành các đoạn nhỏ, ưu tiên cắt ở cuối câu để giọng đọc
    không bị ngắt giữa chừng."""
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []

    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks, current = [], ""
    for s in sentences:
        if not s:
            continue
        # Nếu 1 câu tự nó đã dài hơn max_chars, cắt cưỡng bức theo dấu phẩy/khoảng trắng
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


def _hard_split(s, max_chars):
    """Cắt cưỡng bức 1 chuỗi quá dài: ưu tiên dấu phẩy/chấm phẩy, sau đó
    khoảng trắng, cuối cùng cắt cứng theo số ký tự nếu vẫn không đủ (ví dụ
    văn bản không có dấu câu/khoảng trắng nào)."""
    sub_parts = re.split(r"(?<=[,;:])\s+", s)
    result, buf = [], ""
    for p in sub_parts:
        # Nếu bản thân cụm từ vẫn quá dài (không có dấu phẩy), cắt theo từ
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
                    # Từ đơn vẫn quá dài (hiếm gặp) -> cắt cứng theo ký tự
                    for i in range(0, len(w), max_chars):
                        result.append(w[i:i + max_chars])
                else:
                    buf = w
    if buf:
        result.append(buf.strip())
    return [r for r in result if r]


# ----------------------------------------------------------------------------
# Gộp file .wav thành .mp3 bằng ffmpeg (nếu có sẵn)
# ----------------------------------------------------------------------------
def merge_to_mp3(part_paths, final_mp3_path):
    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        print("\n[Thông báo] Không tìm thấy ffmpeg trên máy, bỏ qua bước gộp mp3.")
        print("Các file .wav từng phần vẫn được giữ nguyên, bạn có thể tự nối bằng ffmpeg sau.")
        return None

    list_file = final_mp3_path + ".concat_list.txt"
    with open(list_file, "w", encoding="utf-8") as f:
        for p in part_paths:
            f.write(f"file '{os.path.abspath(p)}'\n")

    cmd = [
        ffmpeg, "-y", "-f", "concat", "-safe", "0",
        "-i", list_file, "-c:a", "libmp3lame", "-q:a", "2", final_mp3_path,
    ]
    print(f"\nĐang gộp {len(part_paths)} phần thành {final_mp3_path} bằng ffmpeg...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    os.remove(list_file)
    if result.returncode != 0:
        print("[Lỗi] ffmpeg gộp file thất bại:")
        print(result.stderr[-2000:])
        return None
    print(f"Đã tạo file gộp: {final_mp3_path}")
    return final_mp3_path


def _find_ffmpeg():
    from shutil import which
    return which("ffmpeg")


# ----------------------------------------------------------------------------
# Hàm chính
# ----------------------------------------------------------------------------
def format_eta(seconds):
    if seconds < 0 or seconds != seconds:  # NaN check
        return "?"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h:
        return f"{h}h{m:02d}m"
    return f"{m}m{s:02d}s"


def main():
    parser = argparse.ArgumentParser(
        description="Chuyển văn bản (kể cả rất dài) thành giọng nói tiếng Anh bằng Kokoro-82M, chạy CPU đa luồng."
    )
    parser.add_argument("--input", "-i", required=True, help="Đường dẫn file .txt đầu vào (UTF-8)")
    parser.add_argument("--output", "-o", default="output", help="Tiền tố tên file đầu ra (mặc định: output)")
    parser.add_argument("--voice", default="af_heart", help="Giọng đọc, ví dụ: af_heart, af_bella, am_adam, bf_emma, bm_george")
    parser.add_argument("--lang", default="a", choices=["a", "b"], help="'a' = English Mỹ, 'b' = English Anh")
    parser.add_argument("--speed", type=float, default=1.0, help="Tốc độ đọc, 1.0 = bình thường")
    parser.add_argument("--workers", type=int, default=max(1, mp.cpu_count() - 1), help="Số process song song (mặc định: số core CPU - 1)")
    parser.add_argument("--max-chars", type=int, default=400, help="Số ký tự tối đa mỗi đoạn nhỏ gửi vào model")
    parser.add_argument("--part-chars", type=int, default=500_000, help="Số ký tự tối đa mỗi file .wav từng phần (tránh tràn RAM / giới hạn 4GB của WAV)")
    parser.add_argument("--merge-mp3", action="store_true", help="Gộp tất cả các phần thành 1 file .mp3 duy nhất bằng ffmpeg (nếu có)")
    parser.add_argument("--keep-parts", action="store_true", help="Giữ lại các file .wav từng phần sau khi đã gộp mp3")
    args = parser.parse_args()

    if not os.path.isfile(args.input):
        print(f"[Lỗi] Không tìm thấy file: {args.input}")
        sys.exit(1)

    with open(args.input, "r", encoding="utf-8", errors="replace") as f:
        text = f.read()

    print(f"Đã đọc {len(text):,} ký tự từ '{args.input}'")

    chunks = split_into_chunks(text, max_chars=args.max_chars)
    total_chunks = len(chunks)
    total_chars = sum(len(c) for c in chunks)
    if total_chunks == 0:
        print("[Lỗi] File đầu vào rỗng hoặc không có nội dung hợp lệ.")
        sys.exit(1)

    print(f"Chia thành {total_chunks:,} đoạn nhỏ ({total_chars:,} ký tự)")
    print(f"Chạy song song với {args.workers} process, giọng đọc '{args.voice}'\n")

    # Xác định ranh giới từng "phần" (part) dựa theo số ký tự tích lũy
    part_boundaries = []
    cum = 0
    part_idx = 0
    for c in chunks:
        cum += len(c)
        if cum > args.part_chars:
            part_idx += 1
            cum = len(c)
        part_boundaries.append(part_idx)

    indexed_chunks = list(enumerate(chunks))
    errors = []
    part_paths = []
    current_part = -1
    writer = None

    start_time = time.time()
    processed_chars = 0

    with mp.Pool(
        processes=args.workers,
        initializer=init_worker,
        initargs=(args.lang, args.voice, args.speed),
    ) as pool:
        for i, (idx, audio, err) in enumerate(pool.imap(process_chunk, indexed_chunks, chunksize=1)):
            if err:
                errors.append((idx, err))

            part = part_boundaries[i]
            if part != current_part:
                if writer is not None:
                    writer.close()
                current_part = part
                part_path = f"{args.output}_part{part + 1}.wav"
                writer = sf.SoundFile(part_path, mode="w", samplerate=24000, channels=1, subtype="PCM_16")
                part_paths.append(part_path)
                print(f"\n→ Bắt đầu phần {part + 1}: {part_path}")

            if len(audio) > 0:
                writer.write(audio)

            processed_chars += len(chunks[i])
            elapsed = time.time() - start_time
            rate = processed_chars / elapsed if elapsed > 0 else 0
            remaining = (total_chars - processed_chars) / rate if rate > 0 else float("nan")
            pct = processed_chars / total_chars * 100
            print(
                f"  Tiến độ: {i + 1}/{total_chunks} đoạn "
                f"({pct:5.1f}%) | Đã chạy: {format_eta(elapsed)} | Còn lại ước tính: {format_eta(remaining)}",
                end="\r",
            )

    if writer is not None:
        writer.close()

    print(f"\n\nHoàn tất tổng hợp giọng nói trong {format_eta(time.time() - start_time)}")
    print(f"Đã tạo {len(part_paths)} file: {', '.join(part_paths)}")

    if errors:
        err_log = f"{args.output}_errors.log"
        with open(err_log, "w", encoding="utf-8") as f:
            for idx, err in errors:
                f.write(f"[Đoạn {idx}] {err}\n{chunks[idx]}\n\n")
        print(f"[Cảnh báo] Có {len(errors)} đoạn bị lỗi khi xử lý, chi tiết xem tại: {err_log}")

    if args.merge_mp3:
        final_mp3 = f"{args.output}.mp3"
        merged = merge_to_mp3(part_paths, final_mp3)
        if merged and not args.keep_parts:
            for p in part_paths:
                os.remove(p)
            print("Đã xóa các file .wav từng phần (dùng --keep-parts nếu muốn giữ lại).")


if __name__ == "__main__":
    main()
