import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE } from '../config/api';

interface Voice {
    id: string;
    name: string;
    gender: string;
    lang: string;
}

interface VoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    voices: Voice[];
    selectedVoice: string;
    onSelect: (voiceId: string) => void;
    // Settings passed in & out
    language: string;
    onLanguageChange: (val: string) => void;
    speed: number;
    onSpeedChange: (val: number) => void;
    device: string;
    onDeviceChange: (val: string) => void;
    sysInfo: any;
    disabled: boolean;
    voicesLoading?: boolean;
}

function getFlag(lang: string): string {
    if (lang === 'Vietnamese') return '🇻🇳';
    if (lang === 'American English') return '🇺🇸';
    if (lang === 'British English') return '🇬🇧';
    return '🌐';
}

function getRegion(voice: Voice): string {
    const n = voice.name.toLowerCase();
    if (n.includes('bắc') || n.includes('hà nội')) return 'Bắc';
    if (n.includes('trung') || n.includes('huế') || n.includes('đà nẵng')) return 'Trung';
    if (n.includes('nam') || n.includes('sài gòn')) return 'Nam';
    if (voice.lang === 'American English') return 'American';
    if (voice.lang === 'British English') return 'British';
    return '';
}

function getAvatarColor(id: string): string {
    const colors = [
        'from-violet-500 to-purple-700',
        'from-blue-500 to-indigo-700',
        'from-emerald-500 to-teal-700',
        'from-rose-500 to-pink-700',
        'from-amber-500 to-orange-700',
        'from-cyan-500 to-sky-700',
        'from-fuchsia-500 to-violet-700',
        'from-lime-500 to-green-700',
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function getAvatarInitials(name: string): string {
    const parts = name.replace(/[^a-zA-ZÀ-ỹ\s]/g, '').trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

export function VoiceModal({
    isOpen, onClose,
    voices, selectedVoice, onSelect,
    language, onLanguageChange,
    speed, onSpeedChange,
    device, onDeviceChange,
    sysInfo, disabled,
    voicesLoading = false,
}: VoiceModalProps) {
    const hasGpu = sysInfo && (sysInfo.has_cuda || sysInfo.has_mps);
    const [search, setSearch] = useState('');
    const [filterGender, setFilterGender] = useState<'all' | 'Male' | 'Female'>('all');
    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setSearch('');
            setFilterGender('all');
            setTimeout(() => searchRef.current?.focus(), 100);
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
            setPlayingId(null);
        }
    }, [isOpen]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const filtered = (Array.isArray(voices) ? voices : []).filter(v => {
        const q = search.toLowerCase();
        const matchSearch = !q || v.name.toLowerCase().includes(q) || v.id.toLowerCase().includes(q) || v.lang.toLowerCase().includes(q);
        const matchGender = filterGender === 'all' || v.gender === filterGender;
        return matchSearch && matchGender;
    });

    const handlePlay = (e: React.MouseEvent, voiceId: string) => {
        e.stopPropagation();
        if (playingId === voiceId) {
            audioRef.current?.pause();
            setPlayingId(null);
            return;
        }
        if (!audioRef.current) audioRef.current = new Audio();
        const audio = audioRef.current;
        audio.pause();
        setPlayingId(voiceId);
        audio.src = `${API_BASE}/voices/${encodeURIComponent(voiceId)}/preview`;
        audio.load();
        audio.play().catch(() => setPlayingId(null));
        audio.onended = () => setPlayingId(null);
    };

    const handleSelect = (voiceId: string) => {
        onSelect(voiceId);
        onClose();
    };

    const devices = [
        { value: 'auto', label: 'Auto', available: true },
        { value: 'cpu',  label: 'CPU',  available: true },
        { value: 'gpu',  label: 'GPU',  available: !!hasGpu },
    ];

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border border-white/10 shadow-2xl shadow-black/60 overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #12141f 0%, #1a1d2e 100%)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.08]">
                    <span className="text-violet-400 text-xl">🎙</span>
                    <h2 className="text-white font-semibold text-base flex-1">Chọn giọng đọc</h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* ── Settings bar ── */}
                <div className="flex items-center gap-6 px-6 py-3 border-b border-white/[0.06] bg-white/[0.02] flex-wrap">

                    {/* Language */}
                    <div className="flex items-center gap-2.5">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Ngôn ngữ</span>
                        <div className="flex p-0.5 gap-0.5 bg-white/[0.04] rounded-lg border border-white/[0.06]">
                            <button
                                onClick={() => onLanguageChange('en')}
                                disabled={disabled}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${language === 'en' ? 'bg-violet-500/25 text-violet-300' : 'text-slate-400 hover:text-slate-200'} disabled:opacity-50`}
                            >🇺🇸 Tiếng Anh</button>
                            <button
                                onClick={() => onLanguageChange('vi')}
                                disabled={disabled}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${language === 'vi' ? 'bg-violet-500/25 text-violet-300' : 'text-slate-400 hover:text-slate-200'} disabled:opacity-50`}
                            >🇻🇳 Tiếng Việt</button>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="h-5 w-px bg-white/[0.08]" />

                    {/* Speed */}
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                            Tốc độ <span className="text-violet-300 font-mono normal-case">{speed.toFixed(1)}×</span>
                        </span>
                        <input
                            type="range"
                            min="0.5" max="2.0" step="0.1"
                            value={speed}
                            onChange={e => onSpeedChange(parseFloat(e.target.value))}
                            disabled={disabled}
                            className="w-28 h-1.5 rounded-full appearance-none cursor-pointer accent-violet-500 disabled:cursor-not-allowed"
                            style={{
                                background: `linear-gradient(to right, rgb(139,92,246) 0%, rgb(139,92,246) ${((speed - 0.5) / 1.5) * 100}%, rgba(255,255,255,0.1) ${((speed - 0.5) / 1.5) * 100}%, rgba(255,255,255,0.1) 100%)`
                            }}
                        />
                    </div>

                    {/* Divider */}
                    <div className="h-5 w-px bg-white/[0.08]" />

                    {/* Device */}
                    <div className="flex items-center gap-2.5">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Xử lý</span>
                        <div className="flex gap-1">
                            {devices.map(d => (
                                <button
                                    key={d.value}
                                    onClick={() => !disabled && d.available && onDeviceChange(d.value)}
                                    disabled={disabled || !d.available}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all
                                        ${!d.available ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                                        ${device === d.value && d.available
                                            ? 'border-violet-500/50 bg-violet-500/15 text-violet-200'
                                            : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/[0.15] hover:text-slate-200'
                                        }`}
                                    title={!d.available ? 'Không phát hiện GPU' : ''}
                                >
                                    {d.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Search + Filter ── */}
                <div className="flex items-center gap-3 px-6 py-3 border-b border-white/[0.06]">
                    <div className="relative flex-1">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
                        </svg>
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Tìm tên giọng, ngôn ngữ..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder:text-slate-500 outline-none focus:border-violet-500/50 focus:bg-white/[0.07] transition-all"
                        />
                    </div>
                    <div className="flex gap-1 bg-white/[0.04] rounded-xl p-1 border border-white/[0.06]">
                        {(['all', 'Female', 'Male'] as const).map(g => (
                            <button
                                key={g}
                                onClick={() => setFilterGender(g)}
                                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filterGender === g
                                    ? 'bg-violet-500/25 text-violet-300'
                                    : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                {g === 'all' ? 'Tất cả' : g === 'Female' ? '♀ Nữ' : '♂ Nam'}
                            </button>
                        ))}
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap">{filtered.length} giọng</span>
                </div>

                {/* ── Voice grid ── */}
                <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                    {voicesLoading ? (
                        /* Skeleton grid while loading */
                        <div className="grid grid-cols-3 gap-3">
                            {Array.from({ length: 9 }).map((_, i) => (
                                <div key={i} className="flex flex-col gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-full bg-white/[0.08] flex-shrink-0" />
                                        <div className="flex-1 flex flex-col gap-2">
                                            <div className="h-3 rounded-full bg-white/[0.08] w-3/4" />
                                            <div className="h-2.5 rounded-full bg-white/[0.05] w-1/2" />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded bg-white/[0.06]" />
                                        <div className="w-10 h-5 rounded-full bg-white/[0.06]" />
                                        <div className="flex-1" />
                                        <div className="w-7 h-7 rounded-full bg-white/[0.06]" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <span className="text-4xl opacity-30">🔍</span>
                            <p className="text-slate-500 text-sm">Không tìm thấy giọng nào</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-3">
                            {filtered.map(v => {
                                const isSelected = v.id === selectedVoice;
                                const isPlaying = playingId === v.id;
                                const region = getRegion(v);
                                const flag = getFlag(v.lang);
                                const avatarColor = getAvatarColor(v.id);
                                const initials = getAvatarInitials(v.name);

                                return (
                                    <div
                                        key={v.id}
                                        onClick={() => handleSelect(v.id)}
                                        className={`
                                            relative flex flex-col gap-3 p-4 rounded-xl border cursor-pointer
                                            transition-all duration-150 group
                                            ${isSelected
                                                ? 'border-violet-500/60 bg-violet-500/10 shadow-lg shadow-violet-500/10'
                                                : 'border-white/[0.07] bg-white/[0.03] hover:border-white/[0.15] hover:bg-white/[0.05]'
                                            }
                                        `}
                                    >
                                        {isSelected && (
                                            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                                                <svg width="10" height="10" viewBox="0 0 12 12" fill="white">
                                                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                                </svg>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-3">
                                            <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-lg`}>
                                                {initials}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-white text-sm leading-tight truncate">{v.name}</p>
                                                {region && (
                                                    <p className="text-xs text-slate-500 mt-0.5 truncate">{region}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">{flag}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.gender === 'Female'
                                                ? 'bg-pink-500/15 text-pink-300'
                                                : 'bg-blue-500/15 text-blue-300'}`}>
                                                {v.gender === 'Female' ? 'Nữ' : v.gender === 'Male' ? 'Nam' : v.gender}
                                            </span>
                                            <div className="flex-1" />
                                            <button
                                                onClick={e => handlePlay(e, v.id)}
                                                title="Nghe thử"
                                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all
                                                    ${isPlaying
                                                        ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/30'
                                                        : 'bg-white/[0.08] text-slate-400 hover:bg-white/[0.15] hover:text-white'
                                                    }`}
                                            >
                                                {isPlaying ? (
                                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                                                        <rect x="1" y="1" width="3" height="8" rx="1" />
                                                        <rect x="6" y="1" width="3" height="8" rx="1" />
                                                    </svg>
                                                ) : (
                                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                                                        <path d="M2 1.5l7 3.5-7 3.5V1.5z" />
                                                    </svg>
                                                )}
                                            </button>
                                            {!isSelected && (
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleSelect(v.id); }}
                                                    className="hidden group-hover:flex text-xs bg-violet-500/20 hover:bg-violet-500/40 text-violet-300 px-2.5 py-1 rounded-lg font-medium transition-all whitespace-nowrap"
                                                >
                                                    Chọn
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    if (!isOpen) return null;
    return createPortal(modalContent, document.body);
}
