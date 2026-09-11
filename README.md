# TTS Kokoro-82M Web App

Ứng dụng web hoàn chỉnh chuyển văn bản thành giọng nói (Text-to-Speech) tiếng Anh sử dụng Kokoro-82M.
Chạy cục bộ (Local), hoàn toàn miễn phí, hỗ trợ xử lý bằng CPU (multiprocessing) hoặc GPU.

## Tính năng nổi bật
- Xử lý văn bản siêu dài (hàng triệu ký tự) mà không tràn RAM nhờ cơ chế chia nhỏ (chunking) và lưu luồng audio theo từng phần nhỏ.
- Tự động nhận diện phần cứng: Tận dụng GPU NVIDIA (CUDA) hoặc Apple Silicon (MPS) nếu có, tự động chuyển về CPU (đa luồng) nếu không có phần cứng chuyên dụng.
- Giao diện thân thiện, hiện đại, theo dõi tiến độ xử lý theo thời gian thực (real-time).

## Yêu cầu hệ thống
- Python 3.9+
- Node.js 18+ (Để chạy Frontend)
- `ffmpeg` (Dùng để gộp các file audio `.wav` lẻ thành `.mp3`). Nếu không cài `ffmpeg`, ứng dụng sẽ trả về file `.zip` chứa các file `.wav`.
- `espeak-ng` (Yêu cầu bắt buộc của thư viện Kokoro).

## Cài đặt

### Bước 1: Cài đặt công cụ hệ thống

**Windows:**
- Cài đặt `ffmpeg` (thêm vào biến môi trường PATH).
- Cài đặt `espeak-ng` cho Windows.

**macOS (Homebrew):**
```bash
brew install ffmpeg espeak
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install ffmpeg espeak-ng
```

### Bước 2: Cài đặt Backend (Python)

1. Mở terminal, di chuyển vào thư mục dự án (nơi có thư mục `backend/`).
2. Khuyến nghị tạo môi trường ảo (virtual environment):
```bash
python -m venv venv
venv\Scripts\activate   # Trên Windows
# source venv/bin/activate # Trên macOS/Linux
```

3. Cài đặt các thư viện cơ bản:
```bash
pip install fastapi uvicorn pydantic soundfile numpy "kokoro>=0.2.1"
```

4. Cài đặt PyTorch:
- **Nếu chạy CPU hoặc Apple Silicon (Mac M1/M2/M3):**
  ```bash
  pip install torch torchvision torchaudio
  ```
- **Nếu muốn dùng GPU NVIDIA (CUDA):**
  Bạn phải cài phiên bản PyTorch hỗ trợ CUDA. Truy cập https://pytorch.org/get-started/locally/ để lấy lệnh cài chính xác cho phiên bản CUDA của bạn. Ví dụ:
  ```bash
  pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
  ```

### Bước 3: Cài đặt Frontend (Node.js)

1. Di chuyển vào thư mục `frontend/`:
```bash
cd frontend
```
2. Cài đặt các thư viện Node.js:
```bash
npm install
```

## Khởi chạy ứng dụng

Cần chạy 2 terminal riêng biệt:

**1. Khởi chạy Backend (Terminal 1):**
```bash
cd backend
uvicorn main:app --reload
```
Server backend sẽ chạy tại: `http://127.0.0.1:8000`

**2. Khởi chạy Frontend (Terminal 2):**
```bash
cd frontend
npm run dev
```
Trình duyệt sẽ hiển thị link của Vite, thường là: `http://localhost:5173/`

## Kiến trúc

- **Backend (FastAPI)**: Quản lý API REST và WebSocket. Xử lý logic nặng thông qua background task kết hợp với `multiprocessing.Pool` (cho CPU) để đảm bảo không block luồng xử lý (event loop) của API.
- **Frontend (React + Vite)**: Giao diện người dùng thuần túy, kết nối WebSocket để hiển thị ProgressBar mượt mà.

Ứng dụng không sử dụng Celery/Redis nhằm mục đích giữ mọi thứ dễ dàng chạy cục bộ (local) cho người dùng cuối mà không cần thiết lập database/message queue phức tạp. Trạng thái các luồng xử lý (job) được lưu dưới dạng file `state.json` và quản lý thông qua `job_manager.py`.
