import { ApiError } from './api';

type AutosaveTelemetryEvent = {
    action: 'save' | 'retry' | 'reload' | 'keep-local';
    message: string;
    facturaId?: string;
    attempt?: number;
    code?: string;
    status?: number;
    traceId?: string;
    timestamp: string;
};

const TELEMETRY_STORAGE_KEY = 'stockia.autosave.telemetry';
const MAX_EVENTS = 25;

const readEvents = (): AutosaveTelemetryEvent[] => {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(TELEMETRY_STORAGE_KEY);
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const writeEvents = (events: AutosaveTelemetryEvent[]) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
};

export const reportAutosaveError = (
    action: AutosaveTelemetryEvent['action'],
    error: unknown,
    context: { facturaId?: string; attempt?: number; message: string }
) => {
    const event: AutosaveTelemetryEvent = {
        action,
        facturaId: context.facturaId,
        attempt: context.attempt,
        message: context.message,
        timestamp: new Date().toISOString()
    };

    if (error instanceof ApiError) {
        event.code = error.code;
        event.status = error.status;
        event.traceId = error.traceId;
    }

    const events = readEvents();
    events.push(event);
    writeEvents(events);

    console.error('Autosave telemetry', { ...event, error });
};
