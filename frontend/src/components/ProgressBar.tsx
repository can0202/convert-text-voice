import type { JobState } from '../hooks/useJobWebSocket';

interface ProgressBarProps {
    jobState: JobState | null;
}

function formatEta(seconds: number | null): string {
    if (seconds === null || seconds < 0 || isNaN(seconds)) return '?';
    const intSec = Math.floor(seconds);
    const m = Math.floor(intSec / 60);
    const s = intSec % 60;
    const h = Math.floor(m / 60);
    const mRem = m % 60;
    if (h > 0) return `${h}h${mRem.toString().padStart(2, '0')}m`;
    return `${m}m${s.toString().padStart(2, '0')}s`;
}

export function ProgressBar({ jobState }: ProgressBarProps) {
    if (!jobState) return null;

    const { status, percent, processed_chunks, total_chunks, eta_seconds, error } = jobState;

    if (status === 'queued') {
        return (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse-ring" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse-ring" style={{ animationDelay: '300ms' }} />
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse-ring" style={{ animationDelay: '600ms' }} />
                </div>
                <span className="text-sm text-amber-300">Đang xếp hàng chờ xử lý...</span>
            </div>
        );
    }

    if (status === 'failed') {
        return (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="font-semibold text-red-400 text-sm mb-1">Lỗi xảy ra</p>
                <p className="text-xs text-red-300/80">{error}</p>
            </div>
        );
    }

    const pct = Math.max(0, Math.min(100, percent));
    const isCompleted = status === 'completed';

    return (
        <div className="flex flex-col gap-3">
            {/* Status + percent */}
            <div className="flex justify-between items-center text-xs font-medium">
                <span className={isCompleted ? 'text-emerald-400' : 'text-violet-300'}>
                    {isCompleted ? '✓ Hoàn thành!' : 'Đang tổng hợp giọng nói...'}
                </span>
                <span className="font-mono text-slate-300">{pct.toFixed(1)}%</span>
            </div>

            {/* Progress track */}
            <div className="w-full bg-white/[0.06] rounded-full h-2 overflow-hidden">
                <div
                    className={`h-2 rounded-full transition-all duration-500 ease-out ${
                        isCompleted
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : 'bg-gradient-to-r from-violet-600 to-indigo-400'
                    }`}
                    style={{ width: `${pct}%` }}
                />
            </div>

            {/* Chunk info + ETA */}
            <div className="flex justify-between text-[11px] text-slate-500">
                <span>Đoạn: {processed_chunks} / {total_chunks}</span>
                {!isCompleted && eta_seconds !== null && (
                    <span>Còn lại ~{formatEta(eta_seconds)}</span>
                )}
            </div>

            {/* Warning if any */}
            {error && isCompleted && (
                <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    {error}
                </div>
            )}
        </div>
    );
}
