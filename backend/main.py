import os
import sys
# pyrefly: ignore [missing-import]
from fastapi import FastAPI
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from routers import jobs, system

# Ensure we can import from core
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

app = FastAPI(title="TTS Local Web App")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs.router, prefix="/api")
app.include_router(system.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "TTS API is running."}

if __name__ == "__main__":
    # pyrefly: ignore [missing-import]
    import uvicorn
    # pyrefly: ignore [import-error]
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
