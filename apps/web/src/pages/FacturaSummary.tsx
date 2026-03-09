import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Factura, FacturaEstado, FacturaItem } from '@stockia/shared';
import { Loader2, ArrowLeft, CheckCircle, Download, PencilLine, Trash2 } from 'lucide-react';
import { useFactura } from '../context/FacturaContext';
import { api, ApiError } from '../services/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import styles from './FacturaSummary.module.css';

const formatNumber = (value: number) => new Intl.NumberFormat('es-AR').format(value);
const getEstadoLabel = (estado: string) => (estado === 'FINAL' ? 'Final' : 'Borrador');

function exportToCSV(factura: Factura) {
    const rows: string[][] = [['ID', 'Nro', 'Proveedor', 'Fecha', 'Código artículo', 'Marca', 'Tipo', 'Código color', 'Nombre color', 'Talle', 'Cantidad']];

    factura.items.forEach((item) => {
        item.colores.forEach((color) => {
            Object.entries(color.cantidadesPorTalle).forEach(([size, qty]) => {
                rows.push([
                    factura.id,
                    factura.nroFactura,
                    factura.proveedor || '',
                    new Date(factura.fecha).toLocaleDateString('es-AR'),
                    item.codigoArticulo,
                    item.supplierLabel || item.marca || '',
                    item.tipoPrenda,
                    color.codigoColor,
                    color.nombreColor,
                    size,
                    String(qty)
                ]);
            });
        });
    });

    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `factura_${factura.nroFactura}_${Date.now()}.csv`;
    link.click();
}

const sanitizeFileNamePart = (value: string) => value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-_]/g, '');

const formatDatePart = (value: Date | string) => {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
};

function exportToTXT(factura: Factura) {
    const lines: string[] = [];

    factura.items.forEach(item => {
        item.colores.forEach(color => {
            const skuAndColor = `${item.codigoArticulo}${color.codigoColor}`;

            Object.entries(color.cantidadesPorTalle).forEach(([size, quantity]) => {
                const numericQuantity = Number(quantity);
                if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
                    return;
                }

                for (let i = 0; i < numericQuantity; i += 1) {
                    lines.push(`${skuAndColor}!!${size}`);
                }
            });
        });
    });

    const providerPart = sanitizeFileNamePart(factura.proveedor || 'UnknownProvider');
    const creationDatePart = formatDatePart(factura.createdAt);
    const invoiceNumberPart = sanitizeFileNamePart(factura.nroFactura);
    const fileName = `${providerPart}-${creationDatePart}-${invoiceNumberPart}.txt`;

    const txtContent = `${lines.join('\n')}${lines.length > 0 ? '\n' : ''}`;
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
}

const cloneItems = (items: FacturaItem[]) => JSON.parse(JSON.stringify(items)) as FacturaItem[];

const getItemUnits = (item: FacturaItem) => item.colores.reduce((total, color) => (
    total + Object.values(color.cantidadesPorTalle).reduce((acc, qty) => acc + Number(qty), 0)
), 0);

export function FacturaSummary() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { state, loadFactura } = useFactura();
    const [finalizing, setFinalizing] = useState(false);
    const [savingItem, setSavingItem] = useState(false);
    const [deletingItem, setDeletingItem] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
    const [draftItem, setDraftItem] = useState<FacturaItem | null>(null);

    const currentFacturaId = state.currentFactura?.id;

    useEffect(() => {
        if (id && currentFacturaId !== id) {
            loadFactura(id);
        }
    }, [id, currentFacturaId, loadFactura]);

    const stats = useMemo(() => {
        if (!state.currentFactura?.items) return { items: 0, units: 0 };
        let units = 0;
        state.currentFactura.items.forEach(item => {
            item.colores.forEach(color => {
                Object.values(color.cantidadesPorTalle).forEach(q => {
                    units += Number(q);
                });
            });
        });
        return { items: state.currentFactura.items.length, units };
    }, [state.currentFactura]);

    const resetFeedback = () => setFeedback(null);

    const handleFinalize = async () => {
        if (!id || !state.currentFactura) return;
        if (state.currentFactura.estado === FacturaEstado.FINAL) {
            setFeedback({ type: 'error', message: 'La factura ya está finalizada.' });
            return;
        }

        const confirmed = window.confirm('¿Seguro que querés finalizar esta factura? Esta acción no se puede deshacer.');
        if (!confirmed) return;

        setFinalizing(true);
        resetFeedback();
        try {
            await api.finalizeFactura(id, state.currentFactura.updatedAt as string);
            await loadFactura(id);
            setFeedback({ type: 'success', message: 'Factura finalizada correctamente.' });
        } catch (error: unknown) {
            if (error instanceof ApiError) {
                const trace = error.traceId ? ` | traceId: ${error.traceId}` : '';
                setFeedback({ type: 'error', message: `No se pudo finalizar la factura: ${error.message} [${error.code} - ${error.status}]${trace}` });
            } else if (error instanceof Error) {
                setFeedback({ type: 'error', message: `No se pudo finalizar la factura: ${error.message}` });
            } else {
                setFeedback({ type: 'error', message: 'No se pudo finalizar la factura: Error desconocido' });
            }
        }
        setFinalizing(false);
    };

    const openEditModal = (index: number) => {
        if (!state.currentFactura) return;
        setDraftItem(cloneItems([state.currentFactura.items[index]])[0]);
        setEditingIndex(index);
    };

    const closeEditModal = () => {
        setEditingIndex(null);
        setDraftItem(null);
    };

    const handleQuantityChange = (colorIndex: number, size: string, value: string) => {
        if (!draftItem) return;
        const parsed = Number(value);
        const sanitized = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;

        setDraftItem(prev => {
            if (!prev) return prev;
            const next = cloneItems([prev])[0];
            next.colores[colorIndex].cantidadesPorTalle[size] = sanitized;
            return next;
        });
    };

    const handleSaveItem = async () => {
        if (!id || !state.currentFactura || editingIndex === null || !draftItem) return;
        setSavingItem(true);
        resetFeedback();

        const nextItems = cloneItems(state.currentFactura.items);
        nextItems[editingIndex] = draftItem;

        try {
            await api.updateFacturaDraft(id, {
                items: nextItems,
                expectedUpdatedAt: state.currentFactura.updatedAt as string
            });
            await loadFactura(id);
            setFeedback({ type: 'success', message: 'Ítem actualizado correctamente.' });
            closeEditModal();
        } catch (error: unknown) {
            if (error instanceof ApiError) {
                const trace = error.traceId ? ` | traceId: ${error.traceId}` : '';
                setFeedback({ type: 'error', message: `No se pudo actualizar el ítem: ${error.message} [${error.code} - ${error.status}]${trace}` });
            } else if (error instanceof Error) {
                setFeedback({ type: 'error', message: `No se pudo actualizar el ítem: ${error.message}` });
            } else {
                setFeedback({ type: 'error', message: 'No se pudo actualizar el ítem: Error desconocido' });
            }
        }

        setSavingItem(false);
    };

    const handleDeleteItem = async () => {
        if (!id || !state.currentFactura || deletingIndex === null) return;
        setDeletingItem(true);
        resetFeedback();

        const nextItems = state.currentFactura.items.filter((_, index) => index !== deletingIndex);

        try {
            await api.updateFacturaDraft(id, {
                items: nextItems,
                expectedUpdatedAt: state.currentFactura.updatedAt as string
            });
            await loadFactura(id);
            setFeedback({ type: 'success', message: 'Ítem eliminado correctamente.' });
            setDeletingIndex(null);
        } catch (error: unknown) {
            if (error instanceof ApiError) {
                const trace = error.traceId ? ` | traceId: ${error.traceId}` : '';
                setFeedback({ type: 'error', message: `No se pudo eliminar el ítem: ${error.message} [${error.code} - ${error.status}]${trace}` });
            } else if (error instanceof Error) {
                setFeedback({ type: 'error', message: `No se pudo eliminar el ítem: ${error.message}` });
            } else {
                setFeedback({ type: 'error', message: 'No se pudo eliminar el ítem: Error desconocido' });
            }
        }

        setDeletingItem(false);
    };

    if (state.isLoading || !state.currentFactura) {
        return (
            <div className={styles.loaderWrap}>
                <Loader2 size={36} className={styles.loaderSpin} />
            </div>
        );
    }

    const factura = state.currentFactura;
    const isFinal = factura.estado === FacturaEstado.FINAL;

    return (
        <div className={styles.page}>
            {isFinal && (
                <div className={styles.finalBanner}>
                    <CheckCircle size={18} />
                    <span>Esta factura está finalizada y es de solo lectura.</span>
                </div>
            )}

            {feedback && (
                <div className={`${styles.feedback} ${feedback.type === 'error' ? styles.feedbackError : ''}`}>
                    {feedback.message}
                </div>
            )}

            <div className={styles.headerBlock}>
                <div>
                    <h1 className={styles.title}>Resumen de factura</h1>
                    <p className={styles.subtitle}>{factura.nroFactura} • {factura.proveedor || 'Sin proveedor'}</p>
                </div>

                <div className={styles.actions}>
                    <div className={styles.actionGroup}>
                        <Button variant="ghost" onClick={() => navigate('/facturas')} className={styles.actionButton} icon={<ArrowLeft size={16} />}>
                            Volver al listado
                        </Button>
                        {!isFinal && (
                            <>
                                <Button variant="secondary" onClick={() => navigate(`/facturas/${id}/wizard`)} className={styles.actionButton}>
                                    Editar
                                </Button>
                                <Button variant="primary" onClick={handleFinalize} isLoading={finalizing} className={styles.actionButton} icon={<CheckCircle size={16} />}>
                                    Finalizar
                                </Button>
                            </>
                        )}
                    </div>

                    <div className={`${styles.actionGroup} ${styles.actionGroupExport}`}>
                        <Button variant="secondary" onClick={() => exportToCSV(factura)} className={styles.actionButton} icon={<Download size={16} />}>
                            Exportar CSV
                        </Button>
                        <Button variant="secondary" onClick={() => exportToTXT(factura)} className={styles.actionButton} icon={<Download size={16} />}>
                            Exportar TXT
                        </Button>
                    </div>
                </div>
            </div>

            <div className={styles.summaryGrid}>
                <Card title="Resumen">
                    <div className={styles.summaryRows}>
                        <div className={styles.summaryRow}>
                            <span className={styles.label}>Total de ítems</span>
                            <span className={styles.value}>{formatNumber(stats.items)}</span>
                        </div>
                        <div className={styles.summaryRow}>
                            <span className={styles.label}>Total de unidades</span>
                            <span className={styles.value}>{formatNumber(stats.units)}</span>
                        </div>
                        <div className={styles.summaryRow}>
                            <span className={styles.label}>Estado</span>
                            <span className={isFinal ? styles.stateFinal : styles.stateDraft}>
                                {getEstadoLabel(factura.estado)}
                            </span>
                        </div>
                    </div>
                </Card>

                <Card title="Detalle de ítems">
                    <div className={styles.itemList}>
                        {factura.items.length === 0 && (
                            <p className={styles.empty}>No hay ítems cargados.</p>
                        )}

                        {factura.items.map((item, idx) => (
                            <article key={`${item.codigoArticulo}-${idx}`} className={styles.itemCard}>
                                <div className={styles.itemHeader}>
                                    <h3 className={styles.itemTitle}>{item.supplierLabel || item.marca || '-'} - {item.tipoPrenda}</h3>
                                    <span className={styles.itemMeta}>SKU: {item.codigoArticulo}</span>
                                </div>

                                <div className={styles.colorList}>
                                    {item.colores.map((color) => {
                                        const sizes = Object.entries(color.cantidadesPorTalle)
                                            .filter(([, quantity]) => Number(quantity) > 0)
                                            .map(([size, quantity]) => `${size}: ${quantity}`)
                                            .join(' · ');

                                        return (
                                            <div key={color.codigoColor} className={styles.colorRow}>
                                                <span className={styles.colorName}>{color.nombreColor} ({color.codigoColor})</span>
                                                <span className={styles.sizes}>{sizes || 'Sin cantidades cargadas'}</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className={styles.itemFooter}>
                                    <span className={styles.units}>Unidades: {formatNumber(getItemUnits(item))}</span>
                                    {!isFinal && (
                                        <div className={styles.itemActions}>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => openEditModal(idx)}
                                                icon={<PencilLine size={16} />}
                                            >
                                                Editar
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="danger"
                                                size="sm"
                                                onClick={() => setDeletingIndex(idx)}
                                                icon={<Trash2 size={16} />}
                                            >
                                                Eliminar
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                </Card>
            </div>

            {editingIndex !== null && draftItem && (
                <div className={styles.modalOverlay} role="presentation" onClick={closeEditModal}>
                    <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="edit-item-title" onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 id="edit-item-title">Editar ítem</h3>
                            <p>{draftItem.codigoArticulo} • {draftItem.tipoPrenda}</p>
                        </div>

                        <div className={styles.modalBody}>
                            {draftItem.colores.map((color, colorIndex) => (
                                <div key={color.codigoColor} className={styles.editBlock}>
                                    <strong>{color.nombreColor} ({color.codigoColor})</strong>
                                    <div className={styles.editGrid}>
                                        {draftItem.curvaTalles.map((size) => (
                                            <div key={`${color.codigoColor}-${size}`} className={styles.inputGroup}>
                                                <label htmlFor={`${color.codigoColor}-${size}`}>{size}</label>
                                                <input
                                                    id={`${color.codigoColor}-${size}`}
                                                    type="number"
                                                    min={0}
                                                    value={String(color.cantidadesPorTalle[size] ?? 0)}
                                                    onChange={(event) => handleQuantityChange(colorIndex, size, event.target.value)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={styles.modalActions}>
                            <Button type="button" variant="ghost" onClick={closeEditModal}>Cancelar</Button>
                            <Button type="button" variant="primary" onClick={handleSaveItem} isLoading={savingItem}>Guardar cambios</Button>
                        </div>
                    </div>
                </div>
            )}

            {deletingIndex !== null && (
                <div className={styles.modalOverlay} role="presentation" onClick={() => setDeletingIndex(null)}>
                    <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="delete-item-title" onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 id="delete-item-title">Eliminar ítem</h3>
                            <p>¿Seguro que querés eliminar este ítem de la factura? Esta acción no se puede deshacer.</p>
                        </div>
                        <div className={styles.modalActions}>
                            <Button type="button" variant="ghost" onClick={() => setDeletingIndex(null)}>Cancelar</Button>
                            <Button type="button" variant="danger" onClick={handleDeleteItem} isLoading={deletingItem}>Eliminar</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
