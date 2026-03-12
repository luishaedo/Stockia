import { useMemo, useState } from 'react';
import { X, Eye } from 'lucide-react';
import { api, ApiError } from '../../services/api';
import { ArticleImportPreviewResponse } from '../../services/articlesApi';
import { FileUploadField } from '../ui/FileUploadField';
import styles from './BulkArticlesModal.module.css';

type CatalogItem = {
    id: string;
    code: string;
    name?: string;
    description?: string;
};

interface BulkArticlesModalProps {
    isOpen: boolean;
    onClose: () => void;
    supplierOptions: CatalogItem[];
    selectedSupplierId: string;
    onSupplierChange: (supplierId: string) => void;
}

type StatusFilter = 'all' | 'importable' | 'error' | 'warning';

const getCatalogLabel = (item: CatalogItem) => item.name || item.description || item.code;

const formatError = (error: unknown, fallback: string) => {
    if (error instanceof ApiError) {
        return `${error.message} [${error.code}]`;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return fallback;
};

const toCsv = (rows: ArticleImportPreviewResponse['result']['rows']) => {
    const header = ['rowNumber', 'importable', 'warnings', 'errors', 'sku', 'description', 'supplierCode', 'familyCode', 'materialCode', 'categoryCode', 'classificationCode', 'garmentTypeCode', 'sizeCurveCode'];
    const values = rows.map((row) => ([
        row.rowNumber,
        row.importable ? 'YES' : 'NO',
        row.warnings.join(' | '),
        row.errors.join(' | '),
        String(row.normalized.sku ?? ''),
        String(row.normalized.description ?? ''),
        String(row.normalized.supplierCode ?? ''),
        String(row.normalized.familyCode ?? ''),
        String(row.normalized.materialCode ?? ''),
        String(row.normalized.categoryCode ?? ''),
        String(row.normalized.classificationCode ?? ''),
        String(row.normalized.garmentTypeCode ?? ''),
        String(row.normalized.sizeCurveCode ?? '')
    ]));

    const stringify = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    return [header, ...values].map((line) => line.map(stringify).join(',')).join('\n');
};

export function BulkArticlesModal({ isOpen, onClose, supplierOptions, selectedSupplierId, onSupplierChange }: BulkArticlesModalProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewResponse, setPreviewResponse] = useState<ArticleImportPreviewResponse | null>(null);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [committing, setCommitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const selectedSupplierLabel = useMemo(() => {
        if (!selectedSupplierId) return 'Ningún proveedor seleccionado';
        const supplier = supplierOptions.find((item) => item.id === selectedSupplierId);
        return supplier ? `${supplier.code} - ${getCatalogLabel(supplier)}` : 'Proveedor desconocido';
    }, [selectedSupplierId, supplierOptions]);

    const rows = previewResponse?.result.rows ?? [];
    const filteredRows = rows.filter((row) => {
        if (statusFilter === 'importable') return row.importable;
        if (statusFilter === 'error') return row.errors.length > 0;
        if (statusFilter === 'warning') return row.warnings.length > 0;
        return true;
    });

    if (!isOpen) return null;

    const handleFileSelect = (file?: File) => {
        setSelectedFile(file ?? null);
        setPreviewResponse(null);
        setErrorMessage(null);
        setSuccessMessage(null);
    };

    const onPreview = async () => {
        if (!selectedFile) {
            setErrorMessage('Seleccioná un archivo primero.');
            return;
        }

        setLoadingPreview(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const response = await api.previewArticleImport(selectedFile);
            setPreviewResponse(response);
            setStatusFilter('all');
        } catch (error) {
            setErrorMessage(formatError(error, 'No pudimos generar la previsualización'));
        } finally {
            setLoadingPreview(false);
        }
    };

    const onCommit = async () => {
        const previewId = previewResponse?.previewId;
        if (!previewId) {
            setErrorMessage('Primero ejecutá una previsualización válida.');
            return;
        }

        setCommitting(true);
        setErrorMessage(null);
        try {
            const rowNumbers = rows.filter((row) => row.importable).map((row) => row.rowNumber);
            const response = await api.commitArticleImport(previewId, rowNumbers);
            setSuccessMessage(`Importación completada: ${response.summary.importedRows} filas importadas.`);
        } catch (error) {
            setErrorMessage(formatError(error, 'No pudimos confirmar la importación'));
        } finally {
            setCommitting(false);
        }
    };

    const onDownloadReport = () => {
        if (!previewResponse) return;
        const csv = toCsv(previewResponse.result.rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `article-import-report-${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className={styles.overlay} role="presentation" onClick={onClose}>
            <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="bulk-articles-modal-title" onClick={(event) => event.stopPropagation()}>
                <header className={styles.header}>
                    <div>
                        <h2 id="bulk-articles-modal-title">Importación masiva de artículos</h2>
                        <p>Pipeline separado de alta manual: preview → validación por fila → commit confirmado.</p>
                    </div>
                    <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Cerrar modal">
                        <X size={16} />
                    </button>
                </header>

                <section className={styles.section}>
                    <label className={styles.label}>
                        <span>Proveedor (referencia UI)</span>
                        <select className={styles.select} value={selectedSupplierId} onChange={(event) => onSupplierChange(event.target.value)}>
                            <option value="">Seleccionar proveedor</option>
                            {supplierOptions.map((supplier) => (
                                <option key={supplier.id} value={supplier.id}>
                                    {supplier.code} - {getCatalogLabel(supplier)}
                                </option>
                            ))}
                        </select>
                    </label>

                    <FileUploadField
                        label="Archivo de importación"
                        buttonText="Elegir archivo"
                        selectedFileName={selectedFile?.name ?? 'Ningún archivo seleccionado'}
                        accept=".csv,.xls,.xlsx"
                        onFileSelect={handleFileSelect}
                        helperText="Soportado: CSV/XLS/XLSX. Resolverá catálogos por CODE y preservará ceros a la izquierda."
                    />
                    <div className={styles.actionRow}>
                        <button type="button" className={styles.primaryButton} onClick={() => void onPreview()} disabled={loadingPreview || !selectedFile}>
                            {loadingPreview ? 'Procesando preview...' : 'Generar preview'}
                        </button>
                        <button type="button" className={styles.primaryButton} onClick={() => void onCommit()} disabled={committing || !previewResponse?.previewId}>
                            {committing ? 'Importando...' : 'Confirmar importación'}
                        </button>
                        <button type="button" className={styles.secondaryButton} onClick={onDownloadReport} disabled={!previewResponse}>
                            Descargar reporte CSV
                        </button>
                    </div>

                    <p className={styles.activeSupplier}>Proveedor activo: {selectedSupplierLabel}</p>
                    {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}
                    {successMessage && <p className={styles.successText}>{successMessage}</p>}
                </section>

                <section className={styles.previewSection}>
                    <div className={styles.previewHeader}>
                        <p><Eye size={16} /> Previsualización por fila</p>
                        {previewResponse && (
                            <div className={styles.summaryRow}>
                                <span>Total: {previewResponse.result.summary.totalRows}</span>
                                <span>Importables: {previewResponse.result.summary.importableRows}</span>
                                <span>Errores: {previewResponse.result.summary.errorRows}</span>
                                <span>Warnings: {previewResponse.result.summary.warningRows}</span>
                            </div>
                        )}
                    </div>

                    {previewResponse && (
                        <div className={styles.filterRow}>
                            <button type="button" className={styles.filterButton} onClick={() => setStatusFilter('all')}>Todos</button>
                            <button type="button" className={styles.filterButton} onClick={() => setStatusFilter('importable')}>Importables</button>
                            <button type="button" className={styles.filterButton} onClick={() => setStatusFilter('error')}>Con error</button>
                            <button type="button" className={styles.filterButton} onClick={() => setStatusFilter('warning')}>Con warning</button>
                        </div>
                    )}

                    {filteredRows.length > 0 ? (
                        <div className={styles.previewTableWrapper}>
                            <table className={styles.previewTable}>
                                <thead>
                                    <tr>
                                        <th>Fila</th><th>SKU</th><th>Descripción</th><th>Supplier</th><th>Familia</th><th>Estado</th><th>Mensajes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRows.map((row) => (
                                        <tr key={row.rowNumber}>
                                            <td>{row.rowNumber}</td>
                                            <td>{String(row.normalized.sku ?? '')}</td>
                                            <td>{String(row.normalized.description ?? '')}</td>
                                            <td>{String(row.normalized.supplierCode ?? '')}</td>
                                            <td>{String(row.normalized.familyCode ?? '')}</td>
                                            <td>{row.importable ? '✅ Importable' : '❌ Error'}</td>
                                            <td>{[...row.errors, ...row.warnings].join(' | ') || 'Sin observaciones'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className={styles.emptyPreview}>Generá un preview para ver resultados por fila.</p>
                    )}
                </section>
            </div>
        </div>
    );
}
