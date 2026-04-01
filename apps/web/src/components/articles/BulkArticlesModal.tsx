import { useMemo, useState } from 'react';
import { X, Eye, LoaderCircle } from 'lucide-react';
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

type ImportProgress = {
    totalBatches: number;
    currentBatch: number;
};

const BATCH_SIZE = 30;

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

const chunkNumbers = (values: number[], size: number) => {
    const chunks: number[][] = [];
    for (let start = 0; start < values.length; start += size) {
        chunks.push(values.slice(start, start + size));
    }
    return chunks;
};

export function BulkArticlesModal({ isOpen, onClose, supplierOptions, selectedSupplierId, onSupplierChange }: BulkArticlesModalProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewResponse, setPreviewResponse] = useState<ArticleImportPreviewResponse | null>(null);
    const [previewRows, setPreviewRows] = useState<ArticleImportPreviewResponse['result']['rows']>([]);
    const [selectedRowNumbers, setSelectedRowNumbers] = useState<Set<number>>(new Set());
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);
    const [committing, setCommitting] = useState(false);
    const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const selectedSupplierLabel = useMemo(() => {
        if (!selectedSupplierId) return 'Ningún proveedor seleccionado';
        const supplier = supplierOptions.find((item) => item.id === selectedSupplierId);
        return supplier ? `${supplier.code} - ${getCatalogLabel(supplier)}` : 'Proveedor desconocido';
    }, [selectedSupplierId, supplierOptions]);

    const rows = previewRows;
    const importableRowNumbers = rows.filter((row) => row.importable).map((row) => row.rowNumber);
    const selectedImportableRowNumbers = importableRowNumbers.filter((rowNumber) => selectedRowNumbers.has(rowNumber));
    const allRowsSelected = rows.length > 0 && rows.every((row) => selectedRowNumbers.has(row.rowNumber));

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
        setPreviewRows([]);
        setSelectedRowNumbers(new Set());
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
            setPreviewRows(response.result.rows);
            setSelectedRowNumbers(new Set(response.result.rows.map((row) => row.rowNumber)));
            setStatusFilter('all');
        } catch (error) {
            setErrorMessage(formatError(error, 'No pudimos generar la previsualización'));
        } finally {
            setLoadingPreview(false);
        }
    };

    const toggleRowSelection = (rowNumber: number) => {
        setSelectedRowNumbers((current) => {
            const next = new Set(current);
            if (next.has(rowNumber)) {
                next.delete(rowNumber);
            } else {
                next.add(rowNumber);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        setSelectedRowNumbers((current) => {
            if (rows.length > 0 && rows.every((row) => current.has(row.rowNumber))) {
                return new Set();
            }
            return new Set(rows.map((row) => row.rowNumber));
        });
    };

    const removeRowsByRowNumber = (rowNumbers: number[]) => {
        const toRemove = new Set(rowNumbers);
        setPreviewRows((current) => current.filter((row) => !toRemove.has(row.rowNumber)));
        setSelectedRowNumbers((current) => {
            const next = new Set(current);
            rowNumbers.forEach((rowNumber) => next.delete(rowNumber));
            return next;
        });
    };

    const onRemoveSelected = () => {
        if (!selectedRowNumbers.size) return;
        removeRowsByRowNumber(Array.from(selectedRowNumbers));
    };

    const importInBatches = async (rowNumbers: number[]) => {
        const previewId = previewResponse?.previewId;
        if (!previewId) {
            setErrorMessage('Primero ejecutá una previsualización válida.');
            return;
        }

        if (!rowNumbers.length) {
            setErrorMessage('No hay artículos importables para procesar.');
            return;
        }

        const chunks = chunkNumbers(rowNumbers, BATCH_SIZE);
        if (rowNumbers.length > BATCH_SIZE) {
            const confirmed = window.confirm(`Se importarán ${rowNumbers.length} artículos en ${chunks.length} lotes de ${BATCH_SIZE}. ¿Continuar?`);
            if (!confirmed) return;
        }

        setCommitting(true);
        setImportProgress({ totalBatches: chunks.length, currentBatch: 0 });
        setErrorMessage(null);
        setSuccessMessage(null);
        const startedAt = performance.now();
        let createdRows = 0;
        let rejectedRows = 0;

        try {
            for (let index = 0; index < chunks.length; index += 1) {
                const chunk = chunks[index];
                setImportProgress({ totalBatches: chunks.length, currentBatch: index + 1 });

                const response = await api.commitArticleImportBatch(previewId, chunk);
                const successfulRows = response.results
                    .filter((item) => item.status === 'created')
                    .map((item) => item.rowNumber);

                createdRows += response.successCount;
                rejectedRows += response.failedCount;

                if (successfulRows.length > 0) {
                    removeRowsByRowNumber(successfulRows);
                }
            }

            const elapsedMs = Math.max(0, performance.now() - startedAt);
            const elapsedSeconds = (elapsedMs / 1000).toFixed(1);
            setSuccessMessage(`Importación completada. Exitosos: ${createdRows}. Rechazados: ${rejectedRows}. Tiempo: ${elapsedSeconds}s.`);
        } catch (error) {
            setErrorMessage(formatError(error, 'No pudimos confirmar la importación'));
        } finally {
            setCommitting(false);
            setImportProgress(null);
        }
    };

    const onCommitImportable = async () => {
        await importInBatches(importableRowNumbers);
    };

    const onCommitSelected = async () => {
        await importInBatches(selectedImportableRowNumbers);
    };

    const onDownloadReport = () => {
        if (!previewRows.length) return;
        const csv = toCsv(previewRows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `article-import-report-${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const onDownloadTemplate = async () => {
        setDownloadingTemplate(true);
        setErrorMessage(null);

        try {
            const blob = await api.downloadArticleImportTemplate();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `plantilla-importacion-articulos-${new Date().toISOString().slice(0, 10)}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            setErrorMessage(formatError(error, 'No pudimos descargar el template de importación'));
        } finally {
            setDownloadingTemplate(false);
        }
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
                        <select className={styles.select} value={selectedSupplierId} onChange={(event) => onSupplierChange(event.target.value)} disabled={committing}>
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
                        <button type="button" className={styles.secondaryButton} onClick={() => void onDownloadTemplate()} disabled={downloadingTemplate || committing}>
                            {downloadingTemplate ? 'Descargando template...' : 'Descargar template XLSX'}
                        </button>
                        <button type="button" className={styles.primaryButton} onClick={() => void onPreview()} disabled={loadingPreview || !selectedFile || committing}>
                            {loadingPreview ? 'Procesando preview...' : 'Generar preview'}
                        </button>
                        <button type="button" className={styles.primaryButton} onClick={() => void onCommitImportable()} disabled={committing || !previewResponse?.previewId || importableRowNumbers.length === 0}>
                            {committing ? 'Importando...' : 'Importar importables'}
                        </button>
                        <button type="button" className={styles.primaryButton} onClick={() => void onCommitSelected()} disabled={committing || !previewResponse?.previewId || selectedImportableRowNumbers.length === 0}>
                            {committing ? 'Importando...' : 'Import selected'}
                        </button>
                        <button type="button" className={styles.secondaryButton} onClick={onRemoveSelected} disabled={committing || selectedRowNumbers.size === 0}>
                            Remove selected from preview
                        </button>
                        <button type="button" className={styles.secondaryButton} onClick={onDownloadReport} disabled={!previewRows.length}>
                            Descargar reporte CSV
                        </button>
                    </div>

                    {importProgress && (
                        <div className={styles.importProgress} role="status" aria-live="polite">
                            <LoaderCircle size={16} className={styles.spinner} />
                            <span>
                                Cargando lote {importProgress.currentBatch} de {importProgress.totalBatches} de artículos, espere un momento...
                            </span>
                        </div>
                    )}

                    <p className={styles.activeSupplier}>Proveedor activo: {selectedSupplierLabel}</p>
                    {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}
                    {successMessage && <p className={styles.successText}>{successMessage}</p>}
                </section>

                <section className={styles.previewSection}>
                    <div className={styles.previewHeader}>
                        <p><Eye size={16} /> Previsualización por fila</p>
                        {previewResponse && (
                            <div className={styles.summaryRow}>
                                <span>Total: {rows.length}</span>
                                <span>Importables: {rows.filter((row) => row.importable).length}</span>
                                <span>Errores: {rows.filter((row) => row.errors.length > 0).length}</span>
                                <span>Warnings: {rows.filter((row) => row.warnings.length > 0).length}</span>
                            </div>
                        )}
                    </div>

                    {previewResponse && (
                        <>
                            <div className={styles.filterRow}>
                                <button type="button" className={styles.filterButton} onClick={() => setStatusFilter('all')}>Todos</button>
                                <button type="button" className={styles.filterButton} onClick={() => setStatusFilter('importable')}>Importables</button>
                                <button type="button" className={styles.filterButton} onClick={() => setStatusFilter('error')}>Con error</button>
                                <button type="button" className={styles.filterButton} onClick={() => setStatusFilter('warning')}>Con warning</button>
                            </div>
                            <label className={styles.selectAllLabel}>
                                <input type="checkbox" checked={allRowsSelected} onChange={toggleSelectAll} disabled={committing || rows.length === 0} />
                                <span>Select all visible rows</span>
                            </label>
                        </>
                    )}

                    {filteredRows.length > 0 ? (
                        <div className={styles.previewTableWrapper}>
                            <table className={styles.previewTable}>
                                <thead>
                                    <tr>
                                        <th>Select</th><th>Fila</th><th>SKU</th><th>Descripción</th><th>Supplier</th><th>Familia</th><th>Estado</th><th>Mensajes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRows.map((row) => (
                                        <tr key={row.rowNumber}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRowNumbers.has(row.rowNumber)}
                                                    onChange={() => toggleRowSelection(row.rowNumber)}
                                                    disabled={committing}
                                                />
                                            </td>
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
