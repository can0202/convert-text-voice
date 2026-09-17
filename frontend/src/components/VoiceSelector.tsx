import { useRef, useState } from 'react';

interface Voice {
    id: string;
    name: string;
    gender: string;
    lang: string;
}

interface VoiceSelectorProps {
    language: string;
    onLanguageChange: (val: string) => void;
    voices: Voice[];
    selectedVoice: string;
    onVoiceChange: (val: string) => void;
    speed: number;
    onSpeedChange: (val: number) => void;
    device: string;
    onDeviceChange: (val: string) => void;
    sysInfo: any;
    disabled: boolean;
}

export function VoiceSelector({
    language, onLanguageChange,
    voices, selectedVoice, onVoiceChange,
    speed, onSpeedChange,
    device, onDeviceChange,
    sysInfo, disabled
}: VoiceSelectorProps) {
    const hasGpu = sysInfo && (sysInfo.has_cuda || sysInfo.has_mps);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);

    const handleVoiceChange = (val: string) => {
        onVoiceChange(val);
        setPreviewError(null);

        fetch(`http://127.0.0.1:8000/api/voices/${val}/preview`)
            .then(res => {
                const contentType = res.headers.get('content-type') || '';
                if (!res.ok || !contentType.includes('audio')) {
                    setPreviewError('Preview chưa được tạo. Hãy chạy generate_previews.py');
                    return;
                }
                if (audioRef.current) {
                    setIsPreviewing(true);
                    audioRef.current.src = `http://127.0.0.1:8000/api/voices/${val}/preview`;
                    audioRef.current.load();
                    audioRef.current.play()
                        .then(() => setIsPreviewing(false))
                        .catch(e => {
                            setIsPreviewing(false);
                            setPreviewError('Không thể phát preview: ' + e.message);
                        });
                }
            })
            .catch(() => setPreviewError('Không kết nối được backend để lấy preview.'));
    };

    const devices = [
        { value: 'auto', label: 'Auto', available: true },
        { value: 'cpu',  label: 'CPU',  available: true },
        { value: 'gpu',  label: 'GPU',  available: !!hasGpu },
    ];

    const renderVoices = () => {
        if (language === 'en') {
            return voices.map(v => (
                <option key={v.id} value={v.id} style={{ background: '#1e2130' }}>
                    {v.name} ({v.gender}, {v.lang})
                </option>
            ));
        } else {
            const north = voices.filter(v => v.name.includes('[Bắc]') || v.name.toLowerCase().includes('bắc') || v.name.toLowerCase().includes('hà nội'));
            const center = voices.filter(v => v.name.includes('[Trung]') || v.name.toLowerCase().includes('trung') || v.name.toLowerCase().includes('huế') || v.name.toLowerCase().includes('đà nẵng'));
            const south = voices.filter(v => v.name.includes('[Nam]') || v.name.toLowerCase().includes('nam') || v.name.toLowerCase().includes('sài gòn'));
            
            const mappedIds = new Set([...north, ...center, ...south].map(v => v.id));
            const other = voices.filter(v => !mappedIds.has(v.id));

            return (
                <>
                    {north.length > 0 && (
                        <optgroup label="Miền Bắc" style={{ background: '#1e2130', color: '#94a3b8' }}>
                            {north.map(v => <option key={v.id} value={v.id} style={{ color: 'white' }}>{v.name}</option>)}
                        </optgroup>
                    )}
                    {center.length > 0 && (
                        <optgroup label="Miền Trung" style={{ background: '#1e2130', color: '#94a3b8' }}>
                            {center.map(v => <option key={v.id} value={v.id} style={{ color: 'white' }}>{v.name}</option>)}
                        </optgroup>
                    )}
                    {south.length > 0 && (
                        <optgroup label="Miền Nam" style={{ background: '#1e2130', color: '#94a3b8' }}>
                            {south.map(v => <option key={v.id} value={v.id} style={{ color: 'white' }}>{v.name}</option>)}
                        </optgroup>
                    )}
                    {other.length > 0 && (
                        <optgroup label="Khác" style={{ background: '#1e2130', color: '#94a3b8' }}>
                            {other.map(v => <option key={v.id} value={v.id} style={{ color: 'white' }}>{v.name}</option>)}
                        </optgroup>
                    )}
                </>
            );
        }
    };

    return (
        <div className="flex flex-col gap-5">
            {/* Language toggle */}
            <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Ngôn ngữ
                </label>
                <div className="flex p-1 gap-1 bg-white/[0.03] rounded-xl border border-white/[0.08] w-fit">
                    <button
                        onClick={() => onLanguageChange('en')}
                        disabled={disabled}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${language === 'en' ? 'bg-violet-500/20 text-violet-300' : 'text-slate-400 hover:text-slate-200'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        Tiếng Anh
                    </button>
                    <button
                        onClick={() => onLanguageChange('vi')}
                        disabled={disabled}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${language === 'vi' ? 'bg-violet-500/20 text-violet-300' : 'text-slate-400 hover:text-slate-200'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        Tiếng Việt
                    </button>
                </div>
            </div>

            {/* Row 1: Voice & Speed */}
            <div className="grid grid-cols-2 gap-4">
                {/* Voice picker */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Giọng đọc
                    </label>
                    <div className="relative">
                        <select
                            id="voice-select"
                            className="
                                w-full px-3 py-2.5 pr-8 rounded-xl
                                input-dark text-sm appearance-none cursor-pointer
                                disabled:cursor-not-allowed
                            "
                            value={selectedVoice}
                            onChange={(e) => handleVoiceChange(e.target.value)}
                            disabled={disabled}
                        >
                            {renderVoices()}
                        </select>
                        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                    {isPreviewing && (
                        <p className="text-xs text-violet-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse-ring" />
                            Đang phát preview…
                        </p>
                    )}
                </div>

                {/* Speed slider */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                        <span>Tốc độ</span>
                        <span className="text-violet-300 font-mono">{speed.toFixed(1)}×</span>
                    </label>
                    <div className="flex flex-col justify-center h-[42px]">
                        <input
                            type="range"
                            id="speed-slider"
                            min="0.5" max="2.0" step="0.1"
                            value={speed}
                            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                            disabled={disabled}
                            className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-violet-500 disabled:cursor-not-allowed"
                            style={{
                                background: `linear-gradient(to right, rgb(139,92,246) 0%, rgb(139,92,246) ${((speed - 0.5) / 1.5) * 100}%, rgba(255,255,255,0.1) ${((speed - 0.5) / 1.5) * 100}%, rgba(255,255,255,0.1) 100%)`
                            }}
                        />
                        <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                            <span>0.5×</span><span>1.0×</span><span>1.5×</span><span>2.0×</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Row 2: Device selection */}
            <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Chế độ xử lý
                </label>
                <div className="flex gap-2">
                    {devices.map(d => (
                        <label
                            key={d.value}
                            className={`
                                flex items-center gap-2 px-3 py-2 rounded-xl border text-sm
                                cursor-pointer transition-all duration-150 select-none
                                ${!d.available ? 'opacity-30 cursor-not-allowed' : ''}
                                ${device === d.value && d.available
                                    ? 'border-violet-500/50 bg-violet-500/15 text-violet-200'
                                    : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/[0.15] hover:text-slate-300'
                                }
                            `}
                            title={!d.available ? 'Không phát hiện GPU trên máy chủ này' : ''}
                        >
                            <input
                                type="radio"
                                name="device"
                                value={d.value}
                                checked={device === d.value}
                                onChange={() => onDeviceChange(d.value)}
                                disabled={disabled || !d.available}
                                className="hidden"
                            />
                            <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${device === d.value && d.available ? 'border-violet-400' : 'border-slate-600'}`}>
                                {device === d.value && d.available && (
                                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full" />
                                )}
                            </span>
                            {d.label}
                        </label>
                    ))}
                </div>
            </div>

            {/* Preview error banner */}
            {previewError && (
                <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    <span>⚠️</span>
                    <span className="flex-1">{previewError}</span>
                    <button
                        className="text-amber-400 hover:text-amber-200 font-bold ml-auto"
                        onClick={() => setPreviewError(null)}
                    >✕</button>
                </div>
            )}

            <audio ref={audioRef} className="hidden" />
        </div>
    );
}
