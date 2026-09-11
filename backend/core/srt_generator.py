from typing import List, Tuple


def format_srt_time(seconds: float) -> str:
    """Format seconds to SRT timestamp: HH:MM:SS,mmm"""
    total_ms = int(round(seconds * 1000))
    hours = total_ms // 3_600_000
    minutes = (total_ms % 3_600_000) // 60_000
    secs = (total_ms % 60_000) // 1_000
    millis = total_ms % 1_000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def generate_srt(timings: List[Tuple[float, float, str]]) -> str:
    """
    Generate SRT subtitle content from timing data.

    Args:
        timings: List of (start_sec, end_sec, text) tuples.
                 start_sec / end_sec are calculated from audio sample counts.

    Returns:
        SRT format string ready to be written to a .srt file.
    """
    lines = []
    idx = 1
    for start, end, text in timings:
        text = text.strip()
        if not text:
            continue
        # Ensure end > start (guard against zero-length audio chunks)
        if end <= start:
            end = start + 0.1
        lines.append(str(idx))
        lines.append(f"{format_srt_time(start)} --> {format_srt_time(end)}")
        lines.append(text)
        lines.append("")
        idx += 1
    return "\n".join(lines)
