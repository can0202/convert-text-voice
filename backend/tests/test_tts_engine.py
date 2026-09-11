import sys
import os
# pyrefly: ignore [missing-import]
import pytest
from unittest.mock import patch, MagicMock

# Add core to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core import tts_engine

def test_split_into_chunks_empty():
    assert tts_engine.split_into_chunks("") == []
    assert tts_engine.split_into_chunks("   ") == []

def test_split_into_chunks_normal_sentences():
    text = "Hello world. This is a test. How are you?"
    chunks = tts_engine.split_into_chunks(text, max_chars=50)
    assert chunks == ["Hello world.", "This is a test.", "How are you?"]

def test_split_into_chunks_long_sentence_with_commas():
    # A single sentence longer than max_chars (100).
    text = "This is a very long sentence, which contains commas, and we want to see if it splits correctly based on the hard split logic when the sentence itself exceeds the maximum character limit set."
    chunks = tts_engine.split_into_chunks(text, max_chars=100)
    assert len(chunks) > 1
    # Check if they are joined back correctly or split logically
    assert all(len(c) <= 100 for c in chunks)

def test_split_into_chunks_no_punctuation_super_long():
    # A very long string with no punctuation at all
    text = "word " * 100
    chunks = tts_engine.split_into_chunks(text, max_chars=100)
    assert len(chunks) > 1
    assert all(len(c) <= 100 for c in chunks)

@patch('core.tts_engine.torch')
def test_detect_device_with_cuda(mock_torch):
    mock_torch.cuda.is_available.return_value = True
    mock_torch.cuda.get_device_name.return_value = "Mock NVIDIA GPU"
    mock_torch.backends.mps.is_available.return_value = False
    
    info = tts_engine.detect_device()
    assert info["has_cuda"] is True
    assert info["gpu_name"] == "Mock NVIDIA GPU"
    assert info["has_mps"] is False

@patch('core.tts_engine.torch')
def test_detect_device_with_mps(mock_torch):
    mock_torch.cuda.is_available.return_value = False
    mock_torch.backends.mps.is_available.return_value = True
    
    info = tts_engine.detect_device()
    assert info["has_cuda"] is False
    assert info["has_mps"] is True
    assert info["gpu_name"] == "Apple Silicon GPU"

@patch('core.tts_engine.torch')
def test_detect_device_cpu_only(mock_torch):
    mock_torch.cuda.is_available.return_value = False
    mock_torch.backends.mps.is_available.return_value = False
    
    info = tts_engine.detect_device()
    assert info["has_cuda"] is False
    assert info["has_mps"] is False
    assert info["gpu_name"] is None
