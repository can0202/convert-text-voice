import { useState, useEffect } from 'react';

export interface JobState {
    status: string;
    percent: number;
    processed_chunks: number;
    total_chunks: number;
    eta_seconds: number | null;
    error: string | null;
    result_type: string | null;
    has_srt: boolean;
}

export function useJobWebSocket(jobId: string | null) {
    const [state, setState] = useState<JobState | null>(null);

    useEffect(() => {
        if (!jobId) {
            setState(null);
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // In dev mode, assume backend is running on 8000
        const wsUrl = `${protocol}//127.0.0.1:8000/api/jobs/${jobId}/progress`;
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setState(data);
                if (data.status === 'completed' || data.status === 'failed') {
                    ws.close();
                }
            } catch (err) {
                console.error("Failed to parse websocket message", err);
            }
        };

        ws.onerror = (err) => {
            console.error("Websocket error", err);
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [jobId]);

    return state;
}
