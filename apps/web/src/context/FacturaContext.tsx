import React, { createContext, useCallback, useContext, useReducer } from 'react';
import { Factura } from '@stockia/shared';
import { api } from '../services/api';

// --- State Definitions ---

interface FacturaState {
    currentFactura: Factura | null;
    status: 'IDLE' | 'LOADING' | 'SAVING' | 'ERROR';
    error: string | null;
    lastSavedAt: string | null; // For optimistic locking
}

type Action =
    | { type: 'SET_FACTURA'; payload: Factura }
    | { type: 'UPDATE_DRAFT_LOCAL'; payload: Partial<Factura> }
    | { type: 'START_SAVING' }
    | { type: 'FINISH_SAVING'; payload: { updatedAt: string } }
    | { type: 'SET_ERROR'; payload: string };

const initialState: FacturaState = {
    currentFactura: null,
    status: 'IDLE',
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
                error: null
            };
        case 'UPDATE_DRAFT_LOCAL': // Optimistic update
            if (!state.currentFactura) return state;
            return {
                ...state,
                currentFactura: { ...state.currentFactura, ...action.payload }
            };
        case 'START_SAVING':
            return { ...state, status: 'SAVING' };
        case 'FINISH_SAVING':
            return {
                ...state,
                status: 'IDLE',
                lastSavedAt: action.payload.updatedAt
            };
        case 'SET_ERROR':
            return { ...state, status: 'ERROR', error: action.payload };
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
        dispatch({ type: 'START_SAVING' }); // Reusing saving state for loading temporarily or add LOADING
        try {
            const factura = await api.getFactura(id);
            dispatch({ type: 'SET_FACTURA', payload: factura });
        } catch (e: any) {
            dispatch({ type: 'SET_ERROR', payload: e.message });
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
