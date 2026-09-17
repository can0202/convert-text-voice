import sys
import os
import pytest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.srt_generator import format_srt_time, generate_srt

def test_format_srt_time():
    assert format_srt_time(0) == "00:00:00,000"
    assert format_srt_time(1.5) == "00:00:01,500"
    assert format_srt_time(3661.123) == "01:01:01,123"

def test_generate_srt():
    timings = [
        (0.0, 1.5, "Hello world"),
        (2.0, 3.5, "This is a test")
    ]
    srt = generate_srt(timings)
    assert "1\n00:00:00,000 --> 00:00:01,500\nHello world" in srt
    assert "2\n00:00:02,000 --> 00:00:03,500\nThis is a test" in srt
