import { useEffect, useRef, useState } from 'react';
import { useFactura } from '../context/FacturaContext';
import { api, ApiError } from '../services/api';
import { ErrorCodes, UpdateFacturaDraftDTO } from '@stockia/shared';

type DraftPayload = Omit<UpdateFacturaDraftDTO, 'expectedUpdatedAt'>;

interface AutosaveConflictState {
    hasConflict: boolean;
    message: string | null;
}

export function useAutosave(timeout = 2000) {
    const { state, dispatch, loadFactura } = useFactura();
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedState = useRef<string | null>(null);
    const conflictExpectedUpdatedAt = useRef<string | null>(null);
    const pendingPayloadRef = useRef<DraftPayload | null>(null);

    const [conflictState, setConflictState] = useState<AutosaveConflictState>({
        hasConflict: false,
        message: null
    });

    const saveDraft = async (payload: DraftPayload, expectedUpdatedAt: string) => {
        if (!state.currentFactura) return;

        const updated = await api.updateFacturaDraft(state.currentFactura.id, { ...payload, expectedUpdatedAt });

        dispatch({
            type: 'FINISH_SAVING',
            payload: { updatedAt: updated.updatedAt as string }
        });

        conflictExpectedUpdatedAt.current = null;
        setConflictState({ hasConflict: false, message: null });
    };

    const reloadFromServer = async () => {
        if (!state.currentFactura) return;

        try {
            dispatch({ type: 'START_SAVING' });
            await loadFactura(state.currentFactura.id);
            conflictExpectedUpdatedAt.current = null;
            pendingPayloadRef.current = null;
            setConflictState({ hasConflict: false, message: null });
        } catch (error: any) {
            dispatch({ type: 'SET_ERROR', payload: `No se pudo recargar: ${error?.message || 'Error desconocido'}` });
        }
    };

    const keepLocalChanges = async () => {
        if (!state.currentFactura || !pendingPayloadRef.current) return;

        try {
            dispatch({ type: 'START_SAVING' });
            const latestRemote = await api.getFactura(state.currentFactura.id);
            conflictExpectedUpdatedAt.current = latestRemote.updatedAt as string;
            const latestExpectedUpdatedAt = conflictExpectedUpdatedAt.current;
            if (!latestExpectedUpdatedAt) {
                throw new Error('Falta expectedUpdatedAt para resolver el conflicto');
            }
            await saveDraft(pendingPayloadRef.current, latestExpectedUpdatedAt);
        } catch (error: any) {
            dispatch({ type: 'SET_ERROR', payload: `No se pudo reintentar: ${error?.message || 'Error desconocido'}` });
        }
    };

    const retrySave = async () => {
        if (!pendingPayloadRef.current || !state.currentFactura) return;

        try {
            dispatch({ type: 'START_SAVING' });
            await saveDraft(
                pendingPayloadRef.current,
                conflictExpectedUpdatedAt.current || state.lastSavedAt || (state.currentFactura.updatedAt as string)
            );
        } catch (error: any) {
            dispatch({ type: 'SET_ERROR', payload: `No se pudo reintentar: ${error?.message || 'Error desconocido'}` });
        }
    };

    useEffect(() => {
        if (!state.currentFactura) return;

        const currentState = JSON.stringify({
            proveedor: state.currentFactura.proveedor,
            items: state.currentFactura.items
        });

        if (lastSavedState.current === null) {
            lastSavedState.current = currentState;
            return;
        }

        if (currentState === lastSavedState.current) {
            return;
        }

        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        dispatch({ type: 'START_SAVING' });

        timeoutRef.current = setTimeout(async () => {
            if (!state.currentFactura) return;

            const payload: DraftPayload = {
                proveedor: state.currentFactura.proveedor || undefined,
                items: state.currentFactura.items,
                duplicateHandler: 'REPLACE'
            };
            pendingPayloadRef.current = payload;

            let attempt = 0;
            const maxRetries = 3;
            let success = false;

            while (attempt < maxRetries && !success) {
                try {
                    await saveDraft(
                        payload,
                        conflictExpectedUpdatedAt.current || state.lastSavedAt || (state.currentFactura.updatedAt as string)
                    );
                    lastSavedState.current = currentState;
                    success = true;
                } catch (error: any) {
                    const message = error?.message || '';

                    if (error instanceof ApiError && error.code === ErrorCodes.OPTIMISTIC_LOCK_CONFLICT) {
                        setConflictState({
                            hasConflict: true,
                            message: 'Se detectó otra actualización. Elegí cómo continuar.'
                        });
                        dispatch({ type: 'SET_ERROR', payload: 'Se detectó un conflicto de sincronización' });
                        return;
                    }

                    attempt++;
                    if (attempt >= maxRetries) {
                        dispatch({ type: 'SET_ERROR', payload: `No se pudo guardar: ${message}` });
                    } else {
                        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
                    }
                }
            }
        }, timeout);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [state.currentFactura, state.lastSavedAt, timeout, dispatch]);

    return {
        conflictState,
        actions: {
            reloadFromServer,
            keepLocalChanges,
            retrySave
        }
    };
}
