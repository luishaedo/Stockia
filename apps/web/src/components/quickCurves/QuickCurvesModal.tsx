import { useEffect, useMemo, useState } from 'react';
import { X, Trash2, Pencil } from 'lucide-react';
import { api, ApiError, QuickCurveRecord } from '../../services/api';
import styles from './QuickCurvesModal.module.css';

type SizeCurveOption = {
    id: string;
    code: string;
    description: string;
    values: string[];
};

type QuickCurvePayload = Omit<QuickCurveRecord, 'id'>;

interface QuickCurvesModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'apply' | 'manage';
    sizeCurveOptions: SizeCurveOption[];
    initialSizeCurveId?: string;
    onApply?: (values: Record<string, number>) => void;
}

const emptyPayload = (sizeCurveId: string): QuickCurvePayload => ({
    sizeCurveId,
    code: '',
    label: '',
    values: {}
});

const getQuickCurvesErrorMessage = (error: unknown, fallbackMessage: string) => {
    if (error instanceof ApiError) {
        if (error.status === 401 || error.status === 403) {
            return 'Tu sesión expiró o no tenés permisos para administrar curvas rápidas. Volvé a iniciar sesión.';
        }

        if (error.status === 503) {
            return 'El catálogo de curvas rápidas no está disponible todavía. Ejecutá las migraciones pendientes del backend.';
        }

        if (error.status >= 500) {
            const trace = error.traceId ? ` (traceId: ${error.traceId})` : '';
            return `No pudimos procesar la curva rápida por un error interno. Reintentá y, si persiste, compartí este identificador con soporte${trace}.`;
        }
    }

    if (error instanceof Error) {
        return error.message;
    }

    return fallbackMessage;
};

export function QuickCurvesModal({
    isOpen,
    onClose,
    mode,
    sizeCurveOptions,
    initialSizeCurveId,
    onApply
}: QuickCurvesModalProps) {
    const [selectedSizeCurveId, setSelectedSizeCurveId] = useState(initialSizeCurveId ?? '');
    const [quickCurves, setQuickCurves] = useState<QuickCurveRecord[]>([]);
    const [multiplier, setMultiplier] = useState(1);
    const [selectedQuickCurveId, setSelectedQuickCurveId] = useState('');
    const [form, setForm] = useState<QuickCurvePayload>(emptyPayload(initialSizeCurveId ?? ''));
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        if (initialSizeCurveId) {
            setSelectedSizeCurveId(initialSizeCurveId);
        } else if (sizeCurveOptions.length > 0) {
            setSelectedSizeCurveId(sizeCurveOptions[0].id);
        }
    }, [isOpen, initialSizeCurveId, sizeCurveOptions]);

    useEffect(() => {
        if (!isOpen || !selectedSizeCurveId) return;
        setForm((prev) => ({ ...prev, sizeCurveId: selectedSizeCurveId }));
    }, [isOpen, selectedSizeCurveId]);

    const selectedSizeCurve = useMemo(
        () => sizeCurveOptions.find((option) => option.id === selectedSizeCurveId) ?? null,
        [selectedSizeCurveId, sizeCurveOptions]
    );

    const resetForm = (sizeCurveId: string) => {
        setEditingId(null);
        setForm(emptyPayload(sizeCurveId));
    };

    const loadQuickCurves = async (sizeCurveId: string) => {
        if (!sizeCurveId) return;
        setLoading(true);
        setError(null);
        try {
            const response = await api.getQuickCurves(sizeCurveId);
            setQuickCurves(response);
            setSelectedQuickCurveId(response[0]?.id ?? '');
            resetForm(sizeCurveId);
        } catch (loadError) {
            setError(getQuickCurvesErrorMessage(loadError, 'No pudimos cargar las curvas rápidas.'));
            setQuickCurves([]);
            setSelectedQuickCurveId('');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen || !selectedSizeCurveId) return;
        void loadQuickCurves(selectedSizeCurveId);
    }, [isOpen, selectedSizeCurveId]);

    if (!isOpen) return null;

    const selectedQuickCurve = quickCurves.find((item) => item.id === selectedQuickCurveId) ?? null;

    const handleApply = () => {
        if (!selectedQuickCurve || !onApply) return;
        const normalized = Object.fromEntries(
            Object.entries(selectedQuickCurve.values).map(([sizeKey, quantity]) => [sizeKey, Number(quantity) * multiplier])
        );
        onApply(normalized);
        onClose();
    };

    const handleEdit = (curve: QuickCurveRecord) => {
        setEditingId(curve.id);
        setForm({
            sizeCurveId: curve.sizeCurveId,
            code: curve.code,
            label: curve.label,
            values: { ...curve.values }
        });
    };

    const upsertQuickCurve = async () => {
        if (!form.sizeCurveId || !form.code.trim() || !form.label.trim()) {
            setError('Completá código y nombre para la curva rápida.');
            return;
        }

        const hasValues = Object.values(form.values).some((value) => Number(value) >= 0);
        if (!hasValues) {
            setError('Ingresá al menos un valor de cantidad.');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            if (editingId) {
                await api.updateQuickCurve(editingId, form);
            } else {
                await api.createQuickCurve(form);
            }
            await loadQuickCurves(form.sizeCurveId);
        } catch (saveError) {
            setError(getQuickCurvesErrorMessage(saveError, 'No pudimos guardar la curva rápida.'));
        } finally {
            setSaving(false);
        }
    };

    const removeQuickCurve = async (id: string) => {
        setSaving(true);
        setError(null);
        try {
            await api.deleteQuickCurve(id);
            await loadQuickCurves(selectedSizeCurveId);
        } catch (removeError) {
            setError(getQuickCurvesErrorMessage(removeError, 'No pudimos eliminar la curva rápida.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.overlay} role="presentation" onClick={onClose}>
            <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="quick-curves-title" onClick={(event) => event.stopPropagation()}>
                <div className={styles.header}>
                    <h3 id="quick-curves-title">Curva rápida</h3>
                    <button type="button" className={styles.iconButton} onClick={onClose}><X size={16} /></button>
                </div>

                <label className={styles.field}>
                    <span>Curva de talle</span>
                    <select
                        value={selectedSizeCurveId}
                        onChange={(event) => {
                            setSelectedSizeCurveId(event.target.value);
                            setForm((prev) => ({ ...prev, sizeCurveId: event.target.value }));
                        }}
                        disabled={Boolean(initialSizeCurveId)}
                    >
                        {sizeCurveOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.code} - {option.description}
                            </option>
                        ))}
                    </select>
                </label>

                {error && <p className={styles.error}>{error}</p>}

                {loading ? <p className={styles.muted}>Cargando curvas rápidas...</p> : (
                    <div className={styles.list}>
                        {quickCurves.length === 0 && <p className={styles.muted}>No hay curvas rápidas para esta curva de talle.</p>}
                        {quickCurves.map((curve) => (
                            <button
                                type="button"
                                key={curve.id}
                                className={curve.id === selectedQuickCurveId ? styles.listItemActive : styles.listItem}
                                onClick={() => setSelectedQuickCurveId(curve.id)}
                            >
                                <div>
                                    <strong>{curve.code}</strong>
                                    <p>{curve.label}</p>
                                    <small>{Object.entries(curve.values).map(([size, qty]) => `${size}/${qty}`).join(' ')}</small>
                                </div>
                                {mode === 'manage' && (
                                    <span className={styles.inlineActions}>
                                        <span onClick={(event) => { event.stopPropagation(); handleEdit(curve); }}><Pencil size={14} /></span>
                                        <span onClick={(event) => { event.stopPropagation(); void removeQuickCurve(curve.id); }}><Trash2 size={14} /></span>
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {mode === 'apply' && (
                    <div className={styles.applyRow}>
                        <label className={styles.field}>
                            <span>Multiplicador</span>
                            <input type="number" min={1} value={multiplier} onChange={(event) => setMultiplier(Math.max(1, Number(event.target.value) || 1))} />
                        </label>
                        <button type="button" className={styles.primaryButton} onClick={handleApply} disabled={!selectedQuickCurve}>
                            Aplicar curva rápida
                        </button>
                    </div>
                )}

                {mode === 'manage' && selectedSizeCurve && (
                    <div className={styles.editor}>
                        <h4>{editingId ? 'Editar curva rápida' : 'Nueva curva rápida'}</h4>
                        <div className={styles.fieldRow}>
                            <label className={styles.field}>
                                <span>Código</span>
                                <input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} />
                            </label>
                            <label className={styles.field}>
                                <span>Nombre</span>
                                <input value={form.label} onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))} />
                            </label>
                        </div>

                        <div className={styles.valuesGrid}>
                            {selectedSizeCurve.values.map((sizeKey) => (
                                <label key={sizeKey} className={styles.field}>
                                    <span>{sizeKey}</span>
                                    <input
                                        type="number"
                                        min={0}
                                        value={form.values[sizeKey] ?? ''}
                                        onChange={(event) => {
                                            const nextValue = Number(event.target.value) || 0;
                                            setForm((prev) => ({ ...prev, values: { ...prev.values, [sizeKey]: nextValue } }));
                                        }}
                                    />
                                </label>
                            ))}
                        </div>

                        <div className={styles.footer}>
                            <button type="button" className={styles.secondaryButton} onClick={() => resetForm(selectedSizeCurve.id)}>Limpiar</button>
                            <button type="button" className={styles.primaryButton} onClick={() => void upsertQuickCurve()} disabled={saving}>
                                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
