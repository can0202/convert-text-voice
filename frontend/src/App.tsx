import { useState, useEffect } from 'react';
import { TextInput } from './components/TextInput';
import { VoiceSelector } from './components/VoiceSelector';
import { ProgressBar } from './components/ProgressBar';
import { AudioResult } from './components/AudioResult';
import { useJobWebSocket } from './hooks/useJobWebSocket';

function App() {
    const [text, setText] = useState('');
    const [voice, setVoice] = useState('am_echo');
    const [speed, setSpeed] = useState(1.0);
    const [device, setDevice] = useState('auto');
    const [sysInfo, setSysInfo] = useState<any>(null);
    const [voices, setVoices] = useState<any[]>([]);

    const [currentJobId, setCurrentJobId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const jobState = useJobWebSocket(currentJobId);

    useEffect(() => {
        fetch('http://127.0.0.1:8000/api/system-info')
            .then(res => res.json())
            .then(data => setSysInfo(data))
            .catch(err => console.error('Failed to fetch sys info', err));

        fetch('http://127.0.0.1:8000/api/voices')
            .then(res => res.json())
            .then(data => setVoices(data))
            .catch(err => console.error('Failed to fetch voices', err));
    }, []);

    const handleSubmit = async () => {
        if (!text.trim()) {
            alert('Vui lòng nhập nội dung văn bản.');
            return;
        }

        setIsSubmitting(true);
        setCurrentJobId(null);

        try {
            const res = await fetch('http://127.0.0.1:8000/api/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice, speed, device })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.detail || 'Lỗi không xác định');
            }

            const data = await res.json();
            setCurrentJobId(data.job_id);
        } catch (err: any) {
            alert(`Lỗi khi tạo yêu cầu: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isProcessing = jobState && (jobState.status === 'queued' || jobState.status === 'processing');
    const hasResult = jobState && (jobState.status === 'completed' || jobState.status === 'failed');
    const showRightPanel = isProcessing || hasResult;

    const gpuLabel = sysInfo?.has_cuda
        ? `GPU: ${sysInfo.gpu_name}`
        : sysInfo?.has_mps
            ? 'GPU: Apple Silicon'
            : 'CPU Only';

    return (
        <div className="min-h-screen bg-[#0f1117] flex flex-col">
            {/* ── Top Header ── */}
            <header className="border-b border-white/[0.07] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* Logo icon */}
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-white leading-tight">Kokoro TTS</h1>
                        <p className="text-xs text-slate-400 leading-tight">Text-to-Speech · Kokoro-82M</p>
                    </div>
                </div>

                {/* System badge */}
                {sysInfo && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-card text-xs text-slate-300">
                        <span className={`w-1.5 h-1.5 rounded-full ${sysInfo.has_cuda || sysInfo.has_mps ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <span className="font-medium">{gpuLabel}</span>
                        <span className="text-slate-500">·</span>
                        <span>{sysInfo.cpu_cores} cores</span>
                    </div>
                )}
            </header>

            {/* ── Main 2-column layout ── */}
            <main className="flex-1 flex overflow-hidden">

                {/* ── LEFT: Input panel (wider) ── */}
                <div className={`flex flex-col gap-5 p-6 overflow-y-auto scrollbar-thin transition-all duration-300 ${showRightPanel ? 'w-[62%]' : 'w-full  mx-auto'}`}>

                    {/* Text input */}
                    <section className="glass-card rounded-2xl p-5 flex flex-col gap-3">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-violet-400 text-lg">✦</span>
                            <h2 className="font-semibold text-white text-sm">Nội dung văn bản</h2>
                        </div>
                        <TextInput value={text} onChange={setText} disabled={!!isProcessing} />
                    </section>

                    {/* Voice & Settings */}
                    <section className="glass-card rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-violet-400 text-lg">⚙</span>
                            <h2 className="font-semibold text-white text-sm">Cấu hình giọng đọc</h2>
                        </div>
                        <VoiceSelector
                            voices={voices}
                            selectedVoice={voice}
                            onVoiceChange={setVoice}
                            speed={speed}
                            onSpeedChange={setSpeed}
                            device={device}
                            onDeviceChange={setDevice}
                            sysInfo={sysInfo}
                            disabled={!!isProcessing}
                        />
                    </section>

                    {/* Submit button */}
                    <div className="flex justify-start">
                        <button
                            id="btn-generate"
                            onClick={handleSubmit}
                            disabled={!!isProcessing || isSubmitting || text.trim().length === 0}
                            className="
                                relative group flex items-center gap-3
                                px-8 py-3.5 rounded-xl font-semibold text-sm
                                bg-gradient-to-r from-violet-600 to-indigo-600
                                hover:from-violet-500 hover:to-indigo-500
                                disabled:from-slate-700 disabled:to-slate-700
                                disabled:text-slate-500 disabled:cursor-not-allowed
                                text-white shadow-lg shadow-violet-500/25
                                transition-all duration-200 active:scale-95
                                hover:shadow-violet-500/40 hover:shadow-xl
                            "
                        >
                            {(isSubmitting || isProcessing) ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 018-8" />
                                    </svg>
                                    {isSubmitting ? 'Đang gửi...' : 'Đang xử lý...'}
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                                    </svg>
                                    Tạo giọng nói
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* ── RIGHT: Result panel (narrower, slides in) ── */}
                <div className="w-[38%] border-l border-white/[0.07] flex flex-col overflow-y-auto scrollbar-thin animate-fade-in-up">
                    <div className="p-5 flex flex-col gap-4 flex-1">
                        {/* Panel header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-emerald-400">◎</span>
                                <h2 className="font-semibold text-white text-sm">Kết quả</h2>
                            </div>
                            {jobState && (
                                <StatusBadge status={jobState.status} />
                            )}
                        </div>

                        {/* Progress */}
                        <ProgressBar jobState={jobState} />

                        {/* Audio result */}
                        <AudioResult jobId={currentJobId} jobState={jobState} />
                    </div>
                </div>
            </main>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; cls: string; dot: string }> = {
        queued: { label: 'Đang chờ', cls: 'text-amber-400 bg-amber-400/10 border-amber-400/20', dot: 'bg-amber-400 animate-pulse-ring' },
        processing: { label: 'Đang xử lý', cls: 'text-violet-300 bg-violet-400/10 border-violet-400/20', dot: 'bg-violet-400 animate-pulse-ring' },
        completed: { label: 'Hoàn thành', cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', dot: 'bg-emerald-400' },
        failed: { label: 'Thất bại', cls: 'text-red-400 bg-red-400/10 border-red-400/20', dot: 'bg-red-400' },
    };
    const m = map[status] ?? { label: status, cls: 'text-slate-400 bg-slate-400/10 border-slate-400/20', dot: 'bg-slate-400' };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${m.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
            {m.label}
        </span>
    );
}

export default App;
