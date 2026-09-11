interface TextInputProps {
    value: string;
    onChange: (val: string) => void;
    disabled: boolean;
}

/**
 * Insert [pause 0.5s] markers between sentences and paragraphs,
 * mimicking ElevenLabs' "Auto-break" feature for more natural TTS pacing.
 */
function autoBreak(text: string): string {
    let cleaned = text.replace(/\[pause\s+[\d.]+s\]\n?/gi, '').trim();
    const paragraphs = cleaned.split(/\n\s*\n/);

    const processed = paragraphs
        .map(para => {
            const trimmed = para.trim();
            if (!trimmed) return '';
            const sentences = trimmed
                .split(/(?<=[.!?])\s+(?=[A-Z"'\u201C\u2018])/)
                .map(s => s.trim())
                .filter(Boolean);
            return sentences.join('\n[pause 0.5s]\n');
        })
        .filter(Boolean);

    return processed.join('\n[pause 0.5s]\n\n');
}

export function TextInput({ value, onChange, disabled }: TextInputProps) {
    const handleAutoBreak = () => {
        if (!value.trim()) return;
        onChange(autoBreak(value));
    };

    const pauseCount = (value.match(/\[pause\s+[\d.]+s\]/gi) || []).length;
    const charCount = value.length;

    return (
        <div className="w-full flex flex-col gap-3">
            <textarea
                id="text-input"
                className="
                    w-full h-60 p-4 rounded-xl
                    input-dark scrollbar-thin
                    font-mono text-sm leading-relaxed resize-none
                "
                placeholder="Dán hoặc nhập nội dung văn bản tiếng Anh vào đây..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
            />

            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        id="btn-auto-break"
                        onClick={handleAutoBreak}
                        disabled={disabled || !value.trim()}
                        className="
                            inline-flex items-center gap-1.5 px-3 py-1.5
                            text-xs font-medium rounded-lg
                            border border-violet-500/30 text-violet-300
                            bg-violet-500/10 hover:bg-violet-500/20
                            active:scale-95 transition-all
                            disabled:opacity-40 disabled:cursor-not-allowed
                        "
                        title="Tự động chèn [pause 0.5s] giữa các câu để AI đọc tự nhiên hơn"
                    >
                        <span className="text-sm leading-none">✦</span>
                        Tự động ngắt nhịp
                    </button>

                    {pauseCount > 0 && (
                        <span className="text-xs text-violet-400 bg-violet-400/10 border border-violet-400/20 rounded-full px-2 py-0.5">
                            {pauseCount} điểm dừng
                        </span>
                    )}
                </div>

                <span className="text-xs text-slate-500">
                    {charCount.toLocaleString()} ký tự
                </span>
            </div>
        </div>
    );
}
