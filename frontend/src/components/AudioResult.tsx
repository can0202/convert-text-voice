import type { JobState } from '../hooks/useJobWebSocket';

interface AudioResultProps {
    jobId: string | null;
    jobState: JobState | null;
}

export function AudioResult({ jobId, jobState }: AudioResultProps) {
    if (!jobId || !jobState || jobState.status !== 'completed') {
        return null;
    }

    const audioUrl    = `http://127.0.0.1:8000/api/jobs/${jobId}/audio`;
    const downloadUrl = `http://127.0.0.1:8000/api/jobs/${jobId}/download`;
    const srtUrl      = `http://127.0.0.1:8000/api/jobs/${jobId}/download-srt`;
    const audioType   = jobState.result_type === 'wav' ? 'audio/wav' : 'audio/mpeg';

    return (
        <div className="flex flex-col gap-4 animate-fade-in-up">
            {/* Audio player */}
            <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.03] p-3">
                <p className="text-[11px] text-slate-500 mb-2 font-medium uppercase tracking-wider">Nghe thử</p>
                <audio
                    controls
                    className="w-full h-9"
                    style={{ colorScheme: 'dark' }}
                >
                    <source src={audioUrl} type={audioType} />
                    Trình duyệt không hỗ trợ audio.
                </audio>
            </div>

            {/* Download buttons */}
            <div className="flex flex-col gap-2">
                {/* Primary download */}
                <a
                    id="btn-download-main"
                    href={downloadUrl}
                    download
                    className="
                        flex items-center justify-center gap-2
                        px-4 py-2.5 rounded-xl text-sm font-semibold
                        bg-gradient-to-r from-emerald-600 to-teal-600
                        hover:from-emerald-500 hover:to-teal-500
                        text-white shadow-lg shadow-emerald-500/20
                        transition-all duration-200 hover:shadow-emerald-500/35
                        active:scale-[0.98]
                    "
                    title={jobState.has_srt ? 'Tải audio kèm file phụ đề .srt' : 'Tải file audio'}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {jobState.has_srt ? 'Tải Audio + Phụ đề (.zip)' : 'Tải file về máy'}
                </a>

                {/* SRT only */}
                {jobState.has_srt && (
                    <a
                        id="btn-download-srt"
                        href={srtUrl}
                        download="audio.srt"
                        className="
                            flex items-center justify-center gap-2
                            px-4 py-2.5 rounded-xl text-sm font-medium
                            border border-white/[0.1] text-slate-300
                            bg-white/[0.04] hover:bg-white/[0.08]
                            hover:border-white/[0.18] hover:text-white
                            transition-all duration-200 active:scale-[0.98]
                        "
                        title="Tải riêng file phụ đề .srt"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Chỉ tải .srt
                    </a>
                )}
            </div>

            {/* SRT note */}
            {jobState.has_srt && (
                <p className="text-[11px] text-slate-500 leading-relaxed">
                    📄 File .srt có timestamp chính xác, dùng được với VLC, YouTube hoặc bất kỳ trình phát video nào.
                </p>
            )}
        </div>
    );
}
