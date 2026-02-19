import { useEffect, useRef } from 'react';
import { useFactura } from '../context/FacturaContext';
import { api, ApiError } from '../services/api';
import { ErrorCodes } from '@stockia/shared';

export function useAutosave(timeout = 2000) {
    const { state, dispatch } = useFactura();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedState = useRef<string | null>(null);

    useEffect(() => {
        if (!state.currentFactura) return;

        const currentState = JSON.stringify({
            proveedor: state.currentFactura.proveedor,
            items: state.currentFactura.items
        });

        // Initialize ref on load
        if (lastSavedState.current === null) {
            lastSavedState.current = currentState;
            return;
        }

        // Check if changed
        if (currentState === lastSavedState.current) {
            return;
        }

        // Debounce Save
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        dispatch({ type: 'START_SAVING' });

        timeoutRef.current = setTimeout(async () => {
            if (!state.currentFactura) return;

            // Retry Loop Helper
            let attempt = 0;
            const maxRetries = 3;
            let success = false;

            while (attempt < maxRetries && !success) {
                try {
                    const updated = await api.updateFacturaDraft(
                        state.currentFactura.id,
                        {
                            proveedor: state.currentFactura.proveedor || undefined,
                            items: state.currentFactura.items,
                            duplicateHandler: 'REPLACE' // Full sync from frontend state
                        },
                        state.lastSavedAt || undefined // Optimistic Lock
                    );

                    dispatch({
                        type: 'FINISH_SAVING',
                        payload: { updatedAt: updated.updatedAt as string }
                    });
                    lastSavedState.current = currentState;
                    success = true;

                } catch (error: any) {
                    const msg = error?.message || '';
                    if (error instanceof ApiError && error.code === ErrorCodes.OPTIMISTIC_LOCK_CONFLICT) {
                        dispatch({ type: 'SET_ERROR', payload: 'Sync Conflict: Data has changed elsewhere. Please refresh.' });
                        return; // Do not retry on conflict, let user handle it (refresh)
                    }

                    // Retry on other errors (likely network)
                    attempt++;
                    if (attempt >= maxRetries) {
                        dispatch({ type: 'SET_ERROR', payload: `Save Failed: ${msg}` });
                    } else {
                        // Exponential backoff: 500ms, 1000ms, 2000ms
                        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
                    }
                }
            }
        }, timeout);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [state.currentFactura, timeout, dispatch]);
}
