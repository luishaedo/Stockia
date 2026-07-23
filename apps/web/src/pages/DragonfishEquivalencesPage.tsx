import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, FileSpreadsheet, Link2, Plus, RefreshCw, Save, Search, Trash2, Upload, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api, SupplierColorRecord } from '../services/api';
import { ArticleResponse } from '../services/articlesApi';
import { DragonfishEquivalenceRow, DragonfishImportPreview } from '../services/dragonfishApi';
import styles from './DragonfishEquivalencesPage.module.css';

type Supplier = { id: string; code: string; name?: string; description?: string };
type StatusFilter = 'all' | 'mapped' | 'pending';

const errorText = (error: unknown) => error instanceof ApiError
    ? error.message
    : error instanceof Error ? error.message : 'Ocurrió un error inesperado';

const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
};

export function DragonfishEquivalencesPage() {
    const navigate = useNavigate();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [items, setItems] = useState<DragonfishEquivalenceRow[]>([]);
    const [total, setTotal] = useState(0);
    const [q, setQ] = useState('');
    const [supplierId, setSupplierId] = useState('');
    const [status, setStatus] = useState<StatusFilter>('all');
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [draftCodes, setDraftCodes] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const result = await api.listDragonfishEquivalences({
                q: q.trim() || undefined,
                supplierId: supplierId || undefined,
                status,
                pageSize: 200
            });
            setItems(result.items);
            setTotal(result.pagination.total);
            setDraftCodes((current) => {
                const next = { ...current };
                result.items.forEach((item) => {
                    const key = item.id || `${item.articleId}|${item.colorCode}`;
                    if (next[key] === undefined) next[key] = item.dragonfishCode || '';
                });
                return next;
            });
        } catch (error) {
            setMessage({ type: 'error', text: errorText(error) });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void api.getAdminCatalogCached<Supplier[]>('suppliers')
            .then(setSuppliers)
            .catch((error) => setMessage({ type: 'error', text: errorText(error) }));
    }, []);

    useEffect(() => {
        const timeout = window.setTimeout(() => void load(), 250);
        return () => window.clearTimeout(timeout);
    }, [q, supplierId, status]);

    const onSave = async (item: DragonfishEquivalenceRow) => {
        const key = item.id || `${item.articleId}|${item.colorCode}`;
        const code = draftCodes[key]?.trim();
        if (!code) return;
        setSavingKey(key);
        setMessage(null);
        try {
            if (item.id) await api.updateDragonfishEquivalence(item.id, code);
            else await api.createDragonfishEquivalence({ articleId: item.articleId, colorCode: item.colorCode, dragonfishCode: code });
            setMessage({ type: 'success', text: 'Equivalencia guardada.' });
            await load();
        } catch (error) {
            setMessage({ type: 'error', text: errorText(error) });
        } finally {
            setSavingKey(null);
        }
    };

    const onDelete = async (item: DragonfishEquivalenceRow) => {
        if (!item.id || !window.confirm(`¿Eliminar la equivalencia ${item.dragonfishCode}?`)) return;
        setSavingKey(item.id);
        try {
            await api.deleteDragonfishEquivalence(item.id);
            setMessage({ type: 'success', text: 'Equivalencia eliminada.' });
            await load();
        } catch (error) {
            setMessage({ type: 'error', text: errorText(error) });
        } finally {
            setSavingKey(null);
        }
    };

    return (
        <section className={styles.page}>
            <header className={styles.header}>
                <button type="button" className={styles.iconButton} onClick={() => navigate('/articulos')} title="Volver"><ArrowLeft size={20} /></button>
                <div><h1>Equivalencias Dragonfish</h1><p>{total} combinaciones encontradas</p></div>
                <div className={styles.headerActions}>
                    <button type="button" className={styles.secondaryButton} onClick={() => setBulkOpen(true)}><FileSpreadsheet size={17} /> Importar</button>
                    <button type="button" className={styles.primaryButton} onClick={() => setCreateOpen(true)}><Plus size={17} /> Nueva</button>
                </div>
            </header>

            <div className={styles.toolbar}>
                <label className={styles.searchField}><Search size={17} /><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar artículo, color o código Dragonfish" /></label>
                <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
                    <option value="">Todos los proveedores</option>
                    {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.code} - {supplier.name || supplier.description}</option>)}
                </select>
                <div className={styles.segmented} aria-label="Estado">
                    {(['all', 'pending', 'mapped'] as const).map((value) => (
                        <button key={value} type="button" className={status === value ? styles.activeSegment : ''} onClick={() => setStatus(value)}>
                            {value === 'all' ? 'Todas' : value === 'pending' ? 'Pendientes' : 'Cargadas'}
                        </button>
                    ))}
                </div>
                <button type="button" className={styles.refreshButton} onClick={() => void load()} title="Actualizar"><RefreshCw size={17} /></button>
            </div>

            {message && <div className={message.type === 'error' ? styles.errorBanner : styles.successBanner}>{message.text}</div>}
            <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <thead><tr><th>Proveedor</th><th>Artículo</th><th>Color</th><th>Código Dragonfish</th><th>Estado</th><th aria-label="Acciones" /></tr></thead>
                    <tbody>
                        {items.map((item) => {
                            const key = item.id || `${item.articleId}|${item.colorCode}`;
                            return (
                                <tr key={key}>
                                    <td><strong>{item.supplier.code}</strong><span>{item.supplier.label}</span></td>
                                    <td><strong>{item.article.sku}</strong><span>{item.article.description}</span></td>
                                    <td><strong>{item.colorCode === '$' ? 'SIN COLOR' : item.colorCode}</strong><span>{item.colorDescription}</span></td>
                                    <td><input className={styles.codeInput} value={draftCodes[key] || ''} onChange={(event) => setDraftCodes((current) => ({ ...current, [key]: event.target.value.toUpperCase() }))} placeholder="Código Dragonfish" /></td>
                                    <td><span className={item.status === 'pending' ? styles.pendingBadge : styles.mappedBadge}>{item.status === 'pending' ? 'Pendiente' : 'Cargada'}</span></td>
                                    <td><div className={styles.rowActions}>
                                        <button type="button" onClick={() => void onSave(item)} disabled={savingKey === key || !draftCodes[key]?.trim()} title="Guardar"><Save size={16} /></button>
                                        {item.id && <button type="button" onClick={() => void onDelete(item)} disabled={savingKey === key} title="Eliminar"><Trash2 size={16} /></button>}
                                    </div></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {loading && <p className={styles.empty}>Cargando equivalencias...</p>}
                {!loading && items.length === 0 && <p className={styles.empty}>No hay equivalencias para los filtros seleccionados.</p>}
            </div>

            {createOpen && <CreateEquivalenceModal suppliers={suppliers} onClose={() => setCreateOpen(false)} onCreated={async () => {
                setCreateOpen(false);
                setMessage({ type: 'success', text: 'Equivalencia creada.' });
                await load();
            }} />}
            {bulkOpen && <BulkEquivalenceModal onClose={() => setBulkOpen(false)} onImported={async () => {
                setBulkOpen(false);
                setMessage({ type: 'success', text: 'Importación completada.' });
                await load();
            }} />}
        </section>
    );
}

function CreateEquivalenceModal({ suppliers, onClose, onCreated }: {
    suppliers: Supplier[];
    onClose: () => void;
    onCreated: () => Promise<void>;
}) {
    const [supplierId, setSupplierId] = useState('');
    const [articleQuery, setArticleQuery] = useState('');
    const [articles, setArticles] = useState<ArticleResponse[]>([]);
    const [articleId, setArticleId] = useState('');
    const [colors, setColors] = useState<SupplierColorRecord[]>([]);
    const [colorCode, setColorCode] = useState('$');
    const [dragonfishCode, setDragonfishCode] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!supplierId) {
            setArticles([]);
            setColors([]);
            return;
        }
        void api.getSupplierColors(supplierId).then(setColors).catch((reason) => setError(errorText(reason)));
    }, [supplierId]);

    useEffect(() => {
        if (!supplierId) return;
        const timeout = window.setTimeout(() => {
            void api.searchArticles({ supplierId, q: articleQuery, limit: 50 }).then((result) => setArticles(result.items)).catch((reason) => setError(errorText(reason)));
        }, 200);
        return () => window.clearTimeout(timeout);
    }, [supplierId, articleQuery]);

    const selectedArticle = useMemo(() => articles.find((article) => article.id === articleId), [articles, articleId]);
    const submit = async () => {
        if (!articleId || !dragonfishCode.trim()) return;
        setSaving(true);
        setError('');
        try {
            await api.createDragonfishEquivalence({ articleId, colorCode, dragonfishCode });
            await onCreated();
        } catch (reason) {
            setError(errorText(reason));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <div><h2>Nueva equivalencia</h2><p>Primero creá el artículo en Dragonfish y luego cargá su código.</p></div>
                    <button type="button" className={styles.iconButton} onClick={onClose}><X size={18} /></button>
                </div>
                <label>Proveedor<select value={supplierId} onChange={(event) => { setSupplierId(event.target.value); setArticleId(''); }}><option value="">Seleccionar proveedor</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.code} - {supplier.name || supplier.description}</option>)}</select></label>
                <label>Buscar artículo<input value={articleQuery} onChange={(event) => setArticleQuery(event.target.value)} placeholder="SKU o descripción" disabled={!supplierId} /></label>
                <label>Artículo<select value={articleId} onChange={(event) => setArticleId(event.target.value)} disabled={!supplierId}><option value="">Seleccionar artículo</option>{articles.map((article) => <option key={article.id} value={article.id}>{article.sku} - {article.description}</option>)}</select></label>
                <label>Color<select value={colorCode} onChange={(event) => setColorCode(event.target.value)} disabled={!selectedArticle}><option value="$">SIN COLOR</option>{colors.map((color) => <option key={color.id} value={color.code}>{color.code} - {color.value}</option>)}</select></label>
                <label>Código Dragonfish<input value={dragonfishCode} onChange={(event) => setDragonfishCode(event.target.value.toUpperCase())} placeholder="Ej. MTIDTP70095N" /></label>
                {error && <p className={styles.formError}>{error}</p>}
                <div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={onClose}>Cancelar</button><button type="button" className={styles.primaryButton} onClick={() => void submit()} disabled={saving || !articleId || !dragonfishCode.trim()}><Link2 size={17} /> {saving ? 'Guardando...' : 'Guardar equivalencia'}</button></div>
            </div>
        </div>
    );
}

function BulkEquivalenceModal({ onClose, onImported }: { onClose: () => void; onImported: () => Promise<void> }) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<DragonfishImportPreview | null>(null);
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const downloadTemplate = async () => {
        setBusy(true);
        try {
            downloadBlob(await api.downloadDragonfishImportTemplate(), 'plantilla-equivalencias-dragonfish.xlsx');
        } catch (reason) {
            setError(errorText(reason));
        } finally {
            setBusy(false);
        }
    };
    const buildPreview = async () => {
        if (!file) return;
        setBusy(true);
        setError('');
        try {
            const result = await api.previewDragonfishImport(file);
            setPreview(result);
            setSelectedRows(new Set(result.result.rows.filter((row) => row.importable).map((row) => row.rowNumber)));
        } catch (reason) {
            setError(errorText(reason));
        } finally {
            setBusy(false);
        }
    };
    const commit = async () => {
        if (!preview) return;
        setBusy(true);
        try {
            const result = await api.commitDragonfishImport(preview.previewId, Array.from(selectedRows));
            if (result.summary.rejectedRows > 0) {
                setError(`Se importaron algunas filas, pero ${result.summary.rejectedRows} fueron rechazadas.`);
                return;
            }
            await onImported();
        } catch (reason) {
            setError(errorText(reason));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={`${styles.modal} ${styles.bulkModal}`} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                <div className={styles.modalHeader}><div><h2>Importar equivalencias</h2><p>La previsualización no realiza cambios hasta que confirmes.</p></div><button type="button" className={styles.iconButton} onClick={onClose}><X size={18} /></button></div>
                <div className={styles.bulkActions}>
                    <button type="button" className={styles.secondaryButton} onClick={() => void downloadTemplate()} disabled={busy}><Download size={17} /> Plantilla</button>
                    <label className={styles.fileButton}><Upload size={17} /> {file?.name || 'Elegir archivo'}<input type="file" accept=".csv,.xls,.xlsx" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
                    <button type="button" className={styles.primaryButton} onClick={() => void buildPreview()} disabled={!file || busy}>Previsualizar</button>
                </div>
                {error && <p className={styles.formError}>{error}</p>}
                {preview && <>
                    <div className={styles.importSummary}><span>Total: {preview.result.summary.totalRows}</span><span>Válidas: {preview.result.summary.importableRows}</span><span>Crear: {preview.result.summary.createRows}</span><span>Actualizar: {preview.result.summary.updateRows}</span><span>Errores: {preview.result.summary.errorRows}</span></div>
                    <div className={styles.previewTableWrap}><table className={styles.table}>
                        <thead><tr><th /><th>Fila</th><th>Proveedor / artículo</th><th>Color</th><th>Dragonfish</th><th>Resultado</th></tr></thead>
                        <tbody>{preview.result.rows.map((row) => <tr key={row.rowNumber}>
                            <td><input type="checkbox" checked={selectedRows.has(row.rowNumber)} disabled={!row.importable} onChange={() => setSelectedRows((current) => { const next = new Set(current); if (next.has(row.rowNumber)) next.delete(row.rowNumber); else next.add(row.rowNumber); return next; })} /></td>
                            <td>{row.rowNumber}</td>
                            <td><strong>{row.supplierCode} / {row.articleSku}</strong><span>{row.articleDescription}</span></td>
                            <td><strong>{row.colorCode === '$' ? 'SIN COLOR' : row.colorCode}</strong><span>{row.colorDescription}</span></td>
                            <td><strong>{row.dragonfishCode}</strong></td>
                            <td>{row.errors.length > 0 ? <span className={styles.rowError}>{row.errors.join(' · ')}</span> : <span>{row.action === 'create' ? 'Crear' : row.action === 'update' ? 'Actualizar' : 'Sin cambios'}</span>}{row.warnings.length > 0 && <span className={styles.rowWarning}>{row.warnings.join(' · ')}</span>}</td>
                        </tr>)}</tbody>
                    </table></div>
                    <div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={onClose}>Cancelar</button><button type="button" className={styles.primaryButton} onClick={() => void commit()} disabled={busy || selectedRows.size === 0}>Importar {selectedRows.size} filas</button></div>
                </>}
                {!preview && <p className={styles.empty}>Columnas: supplier_code, article_sku, article_description, color_code, color_description y dragonfish_code.</p>}
            </div>
        </div>
    );
}
