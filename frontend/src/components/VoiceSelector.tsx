import { useRef, useState } from 'react';
import { VoiceModal } from './VoiceModal';
import { API_BASE } from '../config/api';

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
    voicesLoading?: boolean;
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

/**
 * Compact bottom-bar trigger that opens the VoiceModal.
 * Renders: [Avatar] [Name · Gender]  [Change ▾]
 */
export function VoiceSelector({
    language, onLanguageChange,
    voices, selectedVoice, onVoiceChange,
    speed, onSpeedChange,
    device, onDeviceChange,
    sysInfo, disabled, voicesLoading = false,
}: VoiceSelectorProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const selectedVoiceObj = Array.isArray(voices) ? voices.find(v => v.id === selectedVoice) : null;

    const handleVoiceSelect = (voiceId: string) => {
        onVoiceChange(voiceId);
        // Auto-play preview
        fetch(`${API_BASE}/voices/${encodeURIComponent(voiceId)}/preview`)
            .then(res => {
                if (!res.ok) return;
                const ct = res.headers.get('content-type') || '';
                if (!ct.includes('audio')) return;
                if (!audioRef.current) audioRef.current = new Audio();
                audioRef.current.src = `${API_BASE}/voices/${encodeURIComponent(voiceId)}/preview`;
                audioRef.current.load();
                audioRef.current.play().catch(() => {});
            })
            .catch(() => {});
    };

    return (
        <>
            {/* Compact trigger bar */}
            <button
                id="voice-change-btn"
                onClick={() => !disabled && !voicesLoading && setIsModalOpen(true)}
                disabled={disabled || voicesLoading}
                className={`
                    inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl
                    border transition-all duration-150 overflow-hidden
                    ${voicesLoading
                        ? 'border-white/[0.06] bg-white/[0.03] cursor-wait'
                        : disabled
                            ? 'border-white/[0.10] bg-white/[0.04] opacity-50 cursor-not-allowed'
                            : 'border-white/[0.10] bg-white/[0.04] hover:border-white/[0.18] hover:bg-white/[0.07] cursor-pointer'
                    }
                `}
            >
                {voicesLoading ? (
                    /* ── Shimmer skeleton ── */
                    <span className="inline-flex items-center gap-2.5 animate-pulse">
                        {/* Avatar skeleton */}
                        <span className="w-7 h-7 rounded-full bg-white/[0.08] flex-shrink-0" />
                        {/* Name skeleton */}
                        <span className="w-24 h-3 rounded-full bg-white/[0.08]" />
                        <span className="w-px h-3 bg-white/[0.06]" />
                        {/* Gender skeleton */}
                        <span className="w-8 h-3 rounded-full bg-white/[0.08]" />
                        {/* Badge skeleton */}
                        <span className="w-16 h-5 rounded-lg bg-violet-500/10 border border-violet-500/20 ml-1" />
                    </span>
                ) : (
                    <>
                        {selectedVoiceObj ? (
                            <>
                                {/* Mini avatar */}
                                <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarColor(selectedVoiceObj.id)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                                    {getAvatarInitials(selectedVoiceObj.name)}
                                </div>
                                <span className="text-sm text-white font-medium">{selectedVoiceObj.name}</span>
                                <span className="text-slate-500">·</span>
                                <span className="text-sm text-slate-400">
                                    {selectedVoiceObj.gender === 'Female' ? 'Nữ' : selectedVoiceObj.gender === 'Male' ? 'Nam' : selectedVoiceObj.gender}
                                </span>
                            </>
                        ) : (
                            <span className="text-sm text-slate-400">Chọn giọng đọc...</span>
                        )}
                        {/* Change label */}
                        <span className="flex items-center gap-1 text-xs text-violet-400 font-medium border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 rounded-lg ml-1">
                            Change
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </span>
                    </>
                )}
            </button>

            {/* Full modal (includes language / speed / device) */}
            <VoiceModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                voices={voices}
                selectedVoice={selectedVoice}
                onSelect={handleVoiceSelect}
                language={language}
                onLanguageChange={onLanguageChange}
                speed={speed}
                onSpeedChange={onSpeedChange}
                device={device}
                onDeviceChange={onDeviceChange}
                sysInfo={sysInfo}
                disabled={disabled}
                voicesLoading={voicesLoading}
            />

            <audio ref={audioRef} className="hidden" />
        </>
    );
}
