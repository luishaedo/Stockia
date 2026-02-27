import React, { createContext, useCallback, useContext, useReducer } from 'react';
import { Factura } from '@stockia/shared';
import { api } from '../services/api';

// --- State Definitions ---

interface FacturaState {
    currentFactura: Factura | null;
    status: 'IDLE' | 'ERROR';
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;
    lastSavedAt: string | null; // For optimistic locking
}

type Action =
    | { type: 'SET_FACTURA'; payload: Factura }
    | { type: 'UPDATE_DRAFT_LOCAL'; payload: Partial<Factura> }
    | { type: 'START_LOADING' }
    | { type: 'FINISH_LOADING' }
    | { type: 'START_SAVING' }
    | { type: 'FINISH_SAVING'; payload: { updatedAt: string } }
    | { type: 'SET_ERROR'; payload: string };

const initialState: FacturaState = {
    currentFactura: null,
    status: 'IDLE',
    isLoading: false,
    isSaving: false,
    error: null,
    lastSavedAt: null,
};

// --- Reducer ---

function facturaReducer(state: FacturaState, action: Action): FacturaState {
    switch (action.type) {
        case 'SET_FACTURA':
            return {
                ...state,
                currentFactura: action.payload,
                lastSavedAt: action.payload.updatedAt as string,
                status: 'IDLE',
                isLoading: false,
                isSaving: false,
                error: null
            };
        case 'UPDATE_DRAFT_LOCAL': // Optimistic update
            if (!state.currentFactura) return state;
            return {
                ...state,
                currentFactura: { ...state.currentFactura, ...action.payload }
            };
        case 'START_LOADING':
            return { ...state, isLoading: true, error: null };
        case 'FINISH_LOADING':
            return { ...state, isLoading: false };
        case 'START_SAVING':
            return { ...state, isSaving: true, error: null };
        case 'FINISH_SAVING':
            return {
                ...state,
                status: 'IDLE',
                isSaving: false,
                lastSavedAt: action.payload.updatedAt
            };
        case 'SET_ERROR':
            return { ...state, status: 'ERROR', isLoading: false, isSaving: false, error: action.payload };
        default:
            return state;
    }
}

// --- Context ---

interface FacturaContextType {
    state: FacturaState;
    loadFactura: (id: string) => Promise<void>;
    createFactura: (nro: string, prov: string) => Promise<string>;
    updateDraft: (changes: Partial<Factura>) => void; // Trigger for autosave hooks
    dispatch: React.Dispatch<Action>; // For advanced usage if needed
}

const FacturaCtx = createContext<FacturaContextType | undefined>(undefined);

export function FacturaProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(facturaReducer, initialState);

    const loadFactura = useCallback(async (id: string) => {
        dispatch({ type: 'START_LOADING' });
        try {
            const factura = await api.getFactura(id);
            dispatch({ type: 'SET_FACTURA', payload: factura });
        } catch (e: any) {
            dispatch({ type: 'SET_ERROR', payload: e.message });
        } finally {
            dispatch({ type: 'FINISH_LOADING' });
        }
    }, []);

    const createFactura = useCallback(async (nro: string, prov: string) => {
        dispatch({ type: 'START_SAVING' });
        try {
            const factura = await api.createFactura({ nroFactura: nro, supplierId: prov, proveedor: prov });
            dispatch({ type: 'SET_FACTURA', payload: factura });
            return factura.id;
        } catch (e: any) {
            dispatch({ type: 'SET_ERROR', payload: e.message });
            throw e;
        }
    }, []);

    const updateDraft = useCallback((changes: Partial<Factura>) => {
        dispatch({ type: 'UPDATE_DRAFT_LOCAL', payload: changes });
    }, []);

    return (
        <FacturaCtx.Provider value={{ state, loadFactura, createFactura, updateDraft, dispatch }}>
            {children}
        </FacturaCtx.Provider>
    );
}

export function useFactura() {
    const context = useContext(FacturaCtx);
    if (!context) throw new Error('useFactura must be used within FacturaProvider');
    return context;
}
