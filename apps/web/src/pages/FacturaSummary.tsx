import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Factura, FacturaEstado, FacturaItem } from '@stockia/shared';
import { Loader2, ArrowLeft, CheckCircle, Download, PencilLine, Trash2, Link2, X } from 'lucide-react';
import { useFactura } from '../context/FacturaContext';
import { api, ApiError } from '../services/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ArticleResponse } from '../services/articlesApi';
import { ArticleDraftForm, MasterArticleResolver, SupplierOption } from '../features/wizard/MasterArticleResolver';
import styles from './FacturaSummary.module.css';

const formatNumber = (value: number) => new Intl.NumberFormat('es-AR').format(value);
const getEstadoLabel = (estado: string) => (estado === 'FINAL' ? 'Final' : 'Borrador');

type CatalogOption = { value: string; label: string; id: string; code: string };
type SizeCurveOption = { value: string; label: string; id: string; values: string[]; code: string };
type AdminCatalogItem = { id: string; code: string; description?: string; name?: string };
type SizeCurveCatalogItem = { id: string; code: string; description: string; values?: Array<{ value: string }> };

const INITIAL_ARTICLE_DRAFT: ArticleDraftForm = {
    sku: '',
    description: '',
    familyId: '',
    categoryId: '',
    garmentTypeId: '',
    classificationId: '',
    materialId: '',
    sizeCurveId: ''
};

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
            const isNoColorVariant = color.codigoColor === '$' && color.nombreColor?.trim().toUpperCase() === 'SIN COLOR';
            const skuAndColor = isNoColorVariant ? item.codigoArticulo : `${item.codigoArticulo}${color.codigoColor}`;

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

const mapCatalogItems = (items: AdminCatalogItem[]) => (
    items.map((entry) => ({
        id: entry.id,
        value: entry.id,
        code: entry.code,
        label: `${entry.code} - ${entry.description || entry.name || entry.code}`
    }))
);

const mapArticleToDraft = (article: ArticleResponse): ArticleDraftForm => ({
    sku: article.sku,
    description: article.description,
    familyId: article.familyId,
    categoryId: article.categoryId,
    garmentTypeId: article.garmentTypeId,
    classificationId: article.classificationId,
    materialId: article.materialId,
    sizeCurveId: article.sizeCurveId
});

const mapItemToDraft = (item: FacturaItem): ArticleDraftForm => ({
    sku: item.codigoArticulo,
    description: item.articleSnapshot?.description || '',
    familyId: '',
    categoryId: '',
    garmentTypeId: item.garmentTypeSnapshot?.id || '',
    classificationId: '',
    materialId: '',
    sizeCurveId: item.sizeCurveId || item.sizeCurveSnapshot?.id || ''
});

const buildItemFingerprint = (item: FacturaItem) => JSON.stringify(item);

export function FacturaSummary() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { state, loadFactura } = useFactura();
    const [finalizing, setFinalizing] = useState(false);
    const [savingItem, setSavingItem] = useState(false);
    const [deletingItem, setDeletingItem] = useState(false);
    const [deletingInvoice, setDeletingInvoice] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
    const [draftItem, setDraftItem] = useState<FacturaItem | null>(null);
    const [resolvingIndex, setResolvingIndex] = useState<number | null>(null);
    const [resolverDraft, setResolverDraft] = useState<ArticleDraftForm>(INITIAL_ARTICLE_DRAFT);
    const [resolverArticle, setResolverArticle] = useState<ArticleResponse | null>(null);
    const [resolvingItem, setResolvingItem] = useState(false);
    const [familyOptions, setFamilyOptions] = useState<CatalogOption[]>([]);
    const [categoryOptions, setCategoryOptions] = useState<CatalogOption[]>([]);
    const [garmentTypeOptions, setGarmentTypeOptions] = useState<CatalogOption[]>([]);
    const [classificationOptions, setClassificationOptions] = useState<CatalogOption[]>([]);
    const [materialOptions, setMaterialOptions] = useState<CatalogOption[]>([]);
    const [sizeCurveOptions, setSizeCurveOptions] = useState<SizeCurveOption[]>([]);
    const [catalogsLoading, setCatalogsLoading] = useState(false);
    const [catalogsError, setCatalogsError] = useState<string | null>(null);

    const currentFacturaId = state.currentFactura?.id;

    useEffect(() => {
        if (id && currentFacturaId !== id) {
            loadFactura(id);
        }
    }, [id, currentFacturaId, loadFactura]);

    useEffect(() => {
        const loadCatalogOptions = async () => {
            setCatalogsLoading(true);
            setCatalogsError(null);
            try {
                const [families, categories, garmentTypes, classifications, materials, sizeCurves] = await Promise.all([
                    api.getAdminCatalogCached<AdminCatalogItem[]>('families'),
                    api.getAdminCatalogCached<AdminCatalogItem[]>('categories'),
                    api.getAdminCatalogCached<AdminCatalogItem[]>('garment-types'),
                    api.getAdminCatalogCached<AdminCatalogItem[]>('classifications'),
                    api.getAdminCatalogCached<AdminCatalogItem[]>('materials'),
                    api.getAdminCatalogCached<SizeCurveCatalogItem[]>('size-curves')
                ]);

                setFamilyOptions(mapCatalogItems(families));
                setCategoryOptions(mapCatalogItems(categories));
                setGarmentTypeOptions(mapCatalogItems(garmentTypes));
                setClassificationOptions(mapCatalogItems(classifications));
                setMaterialOptions(mapCatalogItems(materials));
                setSizeCurveOptions(sizeCurves.map((entry) => ({
                    id: entry.id,
                    code: entry.code,
                    value: entry.id,
                    values: (entry.values || []).map((value) => value.value).filter(Boolean),
                    label: `${entry.code} - ${entry.description}`
                })));
            } catch (error) {
                const message = error instanceof ApiError ? error.message : 'No pudimos cargar los catálogos para resolver el artículo.';
                setCatalogsError(message);
            } finally {
                setCatalogsLoading(false);
            }
        };

        void loadCatalogOptions();
    }, []);

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

        if (state.currentFactura.items.some((item) => !item.articleId?.trim())) {
            setFeedback({ type: 'error', message: 'No podés finalizar mientras existan ítems sin artículo maestro asignado.' });
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

    const openResolveModal = (index: number) => {
        if (!state.currentFactura) return;
        const item = state.currentFactura.items[index];
        setResolvingIndex(index);
        setResolverDraft(mapItemToDraft(item));
        setResolverArticle(null);
    };

    const closeResolveModal = () => {
        setResolvingIndex(null);
        setResolverDraft(INITIAL_ARTICLE_DRAFT);
        setResolverArticle(null);
        setResolvingItem(false);
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

    const handleResolvePendingItem = async () => {
        if (!id || !state.currentFactura || resolvingIndex === null || !resolverArticle) return;

        const currentItem = state.currentFactura.items[resolvingIndex];
        const selectedGarmentType = garmentTypeOptions.find((option) => option.id === resolverArticle.garmentTypeId);
        const sizeCurveOption = sizeCurveOptions.find((option) => option.id === resolverArticle.sizeCurveId);
        const nextItems = cloneItems(state.currentFactura.items);

        nextItems[resolvingIndex] = {
            ...currentItem,
            articleId: resolverArticle.id,
            articleSnapshot: {
                sku: resolverArticle.sku,
                description: resolverArticle.description,
                supplier: {
                    id: resolverArticle.supplier.id,
                    code: resolverArticle.supplier.code,
                    label: resolverArticle.supplier.label
                },
                sizeCurve: {
                    id: resolverArticle.sizeCurve.id,
                    code: resolverArticle.sizeCurve.code,
                    label: resolverArticle.sizeCurve.label,
                    values: resolverArticle.sizeCurve.values
                }
            },
            supplierLabel: resolverArticle.supplier.label,
            marca: resolverArticle.supplier.label,
            tipoPrenda: selectedGarmentType?.label || currentItem.tipoPrenda,
            codigoArticulo: resolverArticle.sku,
            sizeCurveId: resolverArticle.sizeCurveId,
            curvaTalles: resolverArticle.sizeCurve.values,
            garmentTypeSnapshot: selectedGarmentType
                ? { id: selectedGarmentType.id, code: selectedGarmentType.code, label: selectedGarmentType.label }
                : currentItem.garmentTypeSnapshot,
            sizeCurveSnapshot: sizeCurveOption
                ? { id: sizeCurveOption.id, code: sizeCurveOption.code, label: sizeCurveOption.label, values: resolverArticle.sizeCurve.values }
                : currentItem.sizeCurveSnapshot
        };

        setResolvingItem(true);
        resetFeedback();
        try {
            await api.updateFacturaDraft(id, {
                items: nextItems,
                expectedUpdatedAt: state.currentFactura.updatedAt as string
            });
            await loadFactura(id);
            setFeedback({ type: 'success', message: 'Ítem vinculado correctamente a un artículo maestro.' });
            closeResolveModal();
        } catch (error: unknown) {
            if (error instanceof ApiError) {
                const trace = error.traceId ? ` | traceId: ${error.traceId}` : '';
                setFeedback({ type: 'error', message: `No se pudo resolver el ítem: ${error.message} [${error.code} - ${error.status}]${trace}` });
            } else if (error instanceof Error) {
                setFeedback({ type: 'error', message: `No se pudo resolver el ítem: ${error.message}` });
            } else {
                setFeedback({ type: 'error', message: 'No se pudo resolver el ítem: Error desconocido' });
            }
        } finally {
            setResolvingItem(false);
        }
    };

    const handleDeleteItem = async () => {
        if (!id || !state.currentFactura || deletingIndex === null) return;
        setDeletingItem(true);
        resetFeedback();
        const selectedItem = state.currentFactura.items[deletingIndex];
        if (!selectedItem) {
            setFeedback({ type: 'error', message: 'No encontramos el ítem seleccionado para eliminar.' });
            setDeletingItem(false);
            setDeletingIndex(null);
            return;
        }

        const selectedItemFingerprint = buildItemFingerprint(selectedItem);
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
            if (error instanceof ApiError && error.code === 'OPTIMISTIC_LOCK_CONFLICT') {
                try {
                    const latestFactura = await api.getFactura(id);
                    const latestDeleteIndex = latestFactura.items.findIndex((item) => (
                        buildItemFingerprint(item) === selectedItemFingerprint
                    ));

                    if (latestDeleteIndex < 0) {
                        await loadFactura(id);
                        setDeletingIndex(null);
                        setFeedback({
                            type: 'error',
                            message: 'La factura cambió mientras intentábamos eliminar el ítem. Recargamos los datos para que lo intentes nuevamente.'
                        });
                    } else {
                        const latestNextItems = latestFactura.items.filter((_, index) => index !== latestDeleteIndex);
                        await api.updateFacturaDraft(id, {
                            items: latestNextItems,
                            expectedUpdatedAt: latestFactura.updatedAt as string
                        });
                        await loadFactura(id);
                        setFeedback({ type: 'success', message: 'Ítem eliminado correctamente.' });
                        setDeletingIndex(null);
                    }
                } catch (retryError: unknown) {
                    if (retryError instanceof ApiError) {
                        const trace = retryError.traceId ? ` | traceId: ${retryError.traceId}` : '';
                        setFeedback({ type: 'error', message: `No se pudo eliminar el ítem: ${retryError.message} [${retryError.code} - ${retryError.status}]${trace}` });
                    } else if (retryError instanceof Error) {
                        setFeedback({ type: 'error', message: `No se pudo eliminar el ítem: ${retryError.message}` });
                    } else {
                        setFeedback({ type: 'error', message: 'No se pudo eliminar el ítem: Error desconocido' });
                    }
                }
                setDeletingItem(false);
                return;
            }

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

    const handleDeleteInvoice = async () => {
        if (!id || !deletePassword.trim()) {
            setFeedback({ type: 'error', message: 'Ingresá tu contraseña para confirmar la eliminación.' });
            return;
        }

        setDeletingInvoice(true);
        resetFeedback();

        try {
            await api.deleteFactura(id, deletePassword);
            navigate('/facturas');
        } catch (error: unknown) {
            if (error instanceof ApiError) {
                const trace = error.traceId ? ` | traceId: ${error.traceId}` : '';
                setFeedback({ type: 'error', message: `No se pudo eliminar la factura: ${error.message} [${error.code} - ${error.status}]${trace}` });
            } else if (error instanceof Error) {
                setFeedback({ type: 'error', message: `No se pudo eliminar la factura: ${error.message}` });
            } else {
                setFeedback({ type: 'error', message: 'No se pudo eliminar la factura: Error desconocido' });
            }
        }

        setDeletingInvoice(false);
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
    const pendingArticleItems = factura.items.filter((item) => !item.articleId?.trim());
    const supplier = factura.supplierSnapshot
        ? {
            id: factura.supplierSnapshot.id,
            code: factura.supplierSnapshot.code,
            label: factura.supplierSnapshot.label
        } satisfies SupplierOption
        : null;

    return (
        <div className={styles.page}>
            {isFinal && (
                <div className={styles.finalBanner}>
                    <CheckCircle size={18} />
                    <span>Esta factura está finalizada y es de solo lectura.</span>
                </div>
            )}

            {pendingArticleItems.length > 0 && !isFinal && (
                <div className={`${styles.feedback} ${styles.feedbackError}`}>
                    Tenés {pendingArticleItems.length} ítem(s) sin artículo maestro. Resolvelos desde cada tarjeta antes de finalizar.
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
                    <div className={`${styles.actionGroup} ${styles.actionGroupPrimary}`}>
                        <Button variant="ghost" onClick={() => navigate(`/facturas/${id}/wizard`)} className={styles.actionButton} icon={<ArrowLeft size={16} />}>
                            Volver
                        </Button>
                        {!isFinal && (
                            <>
                                <Button variant="secondary" onClick={() => navigate(`/facturas/${id}/wizard`)} className={styles.actionButton}>
                                    Editar
                                </Button>
                                <Button variant="primary" onClick={handleFinalize} isLoading={finalizing} className={styles.actionButton} icon={<CheckCircle size={16} />} disabled={pendingArticleItems.length > 0}>
                                    Finalizar
                                </Button>
                            </>
                        )}
                        <Button variant="danger" onClick={() => setConfirmDeleteOpen(true)} className={styles.actionButton} icon={<Trash2 size={16} />}>
                            Eliminar
                        </Button>
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
                            <span className={styles.label}>Estado</span>
                            <strong className={isFinal ? styles.stateFinal : styles.stateDraft}>{getEstadoLabel(factura.estado)}</strong>
                        </div>
                        <div className={styles.summaryRow}>
                            <span className={styles.label}>Ítems</span>
                            <strong className={styles.value}>{formatNumber(stats.items)}</strong>
                        </div>
                        <div className={styles.summaryRow}>
                            <span className={styles.label}>Unidades</span>
                            <strong className={styles.value}>{formatNumber(stats.units)}</strong>
                        </div>
                    </div>
                </Card>

                <Card title="Ítems de factura">
                    <div className={styles.itemList}>
                        {factura.items.map((item, idx) => (
                            <article key={`${item.codigoArticulo}-${idx}`} className={styles.itemCard}>
                                <div className={styles.itemHeader}>
                                    <h3 className={styles.itemTitle}>SKU: {item.codigoArticulo}</h3>
                                    {item.curvaTalles.length > 0 && item.colores.length > 0 && (
                                        <span className={styles.itemMeta}>
                                            Color: {item.colores.map((color) => `${color.nombreColor} (${color.codigoColor})`).join(' · ')}
                                        </span>
                                    )}
                                    <span className={styles.itemMeta}>Descripción: {item.articleSnapshot?.description || '-'}</span>
                                    {!item.articleId && (
                                        <span className={styles.pendingBadge}>Artículo maestro pendiente</span>
                                    )}
                                </div>

                                {item.colores.length > 0 && (
                                    <div className={styles.colorList}>
                                        {item.colores.map((color) => (
                                            <div key={`${color.codigoColor}-${color.nombreColor}`} className={styles.colorRow}>
                                                <span className={styles.colorName}>{color.nombreColor} ({color.codigoColor})</span>
                                                <span className={styles.sizes}>
                                                    {item.curvaTalles.map((size) => `${size}: ${formatNumber(Number(color.cantidadesPorTalle[size] ?? 0))}`).join(' · ')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className={styles.itemFooter}>
                                    <span className={styles.units}>Unidades: {formatNumber(getItemUnits(item))}</span>
                                    {!isFinal && (
                                        <div className={styles.itemActions}>
                                            {!item.articleId && (
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => openResolveModal(idx)}
                                                    icon={<Link2 size={16} />}
                                                >
                                                    Resolver artículo
                                                </Button>
                                            )}
                                            {item.colores.length > 0 && (
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => openEditModal(idx)}
                                                    icon={<PencilLine size={16} />}
                                                >
                                                    Editar cantidades
                                                </Button>
                                            )}
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
                        {factura.items.length === 0 && <p className={styles.empty}>No hay ítems cargados.</p>}
                    </div>
                </Card>
            </div>

            {editingIndex !== null && draftItem && (
                <div className={styles.modalOverlay} role="presentation" onClick={closeEditModal}>
                    <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="edit-item-title" onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalHeaderRow}>
                                <h3 id="edit-item-title">Editar ítem</h3>
                                <button type="button" className={styles.modalCloseButton} onClick={closeEditModal} aria-label="Cerrar edición de ítem">
                                    <X size={16} />
                                </button>
                            </div>
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

            {resolvingIndex !== null && supplier && (
                <div className={styles.modalOverlay} role="presentation" onClick={closeResolveModal}>
                    <div className={`${styles.modalCard} ${styles.resolveModalCard}`} role="dialog" aria-modal="true" aria-labelledby="resolve-item-title" onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalHeaderRow}>
                                <h3 id="resolve-item-title">Resolver artículo pendiente</h3>
                                <button type="button" className={styles.modalCloseButton} onClick={closeResolveModal} aria-label="Cerrar resolución de artículo">
                                    <X size={16} />
                                </button>
                            </div>
                            <p>Buscá, creá o cloná un maestro y vinculalo sobre este ítem legacy.</p>
                        </div>

                        <div className={styles.modalBody}>
                            <MasterArticleResolver
                                title="Resolver artículo maestro"
                                subtitle="Este flujo reemplaza el vínculo del ítem actual sin tocar colores ni cantidades."
                                confirmLabel={resolvingItem ? 'Guardando...' : 'Guardar artículo maestro'}
                                supplier={supplier}
                                supplierLocked
                                selectedArticle={resolverArticle}
                                articleDraft={resolverDraft}
                                familyOptions={familyOptions}
                                categoryOptions={categoryOptions}
                                garmentTypeOptions={garmentTypeOptions}
                                classificationOptions={classificationOptions}
                                materialOptions={materialOptions}
                                sizeCurveOptions={sizeCurveOptions}
                                catalogsLoading={catalogsLoading}
                                catalogsError={catalogsError}
                                onDraftChange={(field, value) => {
                                    setResolverDraft((prev) => ({ ...prev, [field]: value }));
                                    if (resolverArticle && mapArticleToDraft(resolverArticle)[field] !== value) {
                                        setResolverArticle(null);
                                    }
                                }}
                                onArticleSelected={(article) => {
                                    setResolverArticle(article);
                                    setResolverDraft(mapArticleToDraft(article));
                                }}
                                onConfirm={() => void handleResolvePendingItem()}
                                readOnly={resolvingItem}
                            />
                        </div>

                        <div className={styles.modalActions}>
                            <Button type="button" variant="ghost" onClick={closeResolveModal} disabled={resolvingItem}>Cancelar</Button>
                        </div>
                    </div>
                </div>
            )}

            {confirmDeleteOpen && (
                <div className={styles.modalOverlay} role="presentation" onClick={() => setConfirmDeleteOpen(false)}>
                    <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="delete-invoice-title" onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 id="delete-invoice-title">Eliminar factura</h3>
                            <p>Esta acción elimina la factura y no se puede deshacer.</p>
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.inputGroup}>
                                <label htmlFor="delete-password">Contraseña</label>
                                <input
                                    id="delete-password"
                                    type="password"
                                    value={deletePassword}
                                    onChange={(event) => setDeletePassword(event.target.value)}
                                />
                            </div>
                        </div>

                        <div className={styles.modalActions}>
                            <Button type="button" variant="ghost" onClick={() => setConfirmDeleteOpen(false)}>Cancelar</Button>
                            <Button type="button" variant="danger" onClick={handleDeleteInvoice} isLoading={deletingInvoice}>Eliminar</Button>
                        </div>
                    </div>
                </div>
            )}

            {deletingIndex !== null && (
                <div className={styles.modalOverlay} role="presentation" onClick={() => setDeletingIndex(null)}>
                    <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="delete-item-title" onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 id="delete-item-title">Eliminar ítem</h3>
                            <p>¿Seguro que querés eliminar este ítem de la factura?</p>
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
