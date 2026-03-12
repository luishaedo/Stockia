import { useMemo, useState } from 'react';
import { X, Eye } from 'lucide-react';
import { FileUploadField } from '../ui/FileUploadField';
import styles from './BulkArticlesModal.module.css';

type CatalogItem = {
    id: string;
    code: string;
    name?: string;
    description?: string;
};

type BulkPreviewRow = {
    sku: string;
    descriptionSku: string;
    family: string;
    familyDescription: string;
    type: string;
    typeDescription: string;
};

interface BulkArticlesModalProps {
    isOpen: boolean;
    onClose: () => void;
    supplierOptions: CatalogItem[];
    selectedSupplierId: string;
    onSupplierChange: (supplierId: string) => void;
}

const getCatalogLabel = (item: CatalogItem) => item.name || item.description || item.code;

const previewHeaders = [
    'SKU',
    'Descripción SKU',
    'Código de familia',
    'Descripción de familia',
    'Código de tipo',
    'Descripción de tipo'
];

export function BulkArticlesModal({ isOpen, onClose, supplierOptions, selectedSupplierId, onSupplierChange }: BulkArticlesModalProps) {
    const [selectedFileName, setSelectedFileName] = useState('Ningún archivo seleccionado');
    const [previewRows, setPreviewRows] = useState<BulkPreviewRow[]>([]);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);

    const hasPreview = previewRows.length > 0;

    const selectedSupplierLabel = useMemo(() => {
        if (!selectedSupplierId) return 'Ningún proveedor seleccionado';
        const supplier = supplierOptions.find((item) => item.id === selectedSupplierId);
        return supplier ? `${supplier.code} - ${getCatalogLabel(supplier)}` : 'Proveedor desconocido';
    }, [selectedSupplierId, supplierOptions]);

    if (!isOpen) return null;

    const handleFileSelect = (file?: File) => {
        setPreviewRows([]);
        if (!file) {
            setSelectedFileName('Ningún archivo seleccionado');
            setInfoMessage(null);
            return;
        }

        setSelectedFileName(file.name);
        setInfoMessage('CSV seleccionado. En el siguiente paso vamos a parsear y validar el orden de las columnas.');

        setPreviewRows([
            {
                sku: 'SKU-0001',
                descriptionSku: 'Artículo de ejemplo importado',
                family: '99',
                familyDescription: 'Varios',
                type: '12',
                typeDescription: 'Remera'
            }
        ]);
    };

    return (
        <div className={styles.overlay} role="presentation" onClick={onClose}>
            <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="bulk-articles-modal-title" onClick={(event) => event.stopPropagation()}>
                <header className={styles.header}>
                    <div>
                        <h2 id="bulk-articles-modal-title">Gestión masiva de artículos</h2>
                        <p>Cargá un CSV, previsualizá el contenido y luego creá/actualizá artículos del proveedor.</p>
                    </div>
                    <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Cerrar modal">
                        <X size={16} />
                    </button>
                </header>

                <section className={styles.section}>
                    <label className={styles.label}>
                        <span>Proveedor</span>
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
                        label="Archivo CSV"
                        buttonText="Elegir CSV"
                        selectedFileName={selectedFileName}
                        accept=".csv,text/csv"
                        onFileSelect={handleFileSelect}
                        helperText="Columnas esperadas (borrador): sku, descriptionsku, family, description_family, type, description_type"
                    />

                    <p className={styles.activeSupplier}>Proveedor activo: {selectedSupplierLabel}</p>
                    {infoMessage && <p className={styles.infoText}>{infoMessage}</p>}
                </section>

                <section className={styles.previewSection}>
                    <div className={styles.previewHeader}>
                        <p>
                            <Eye size={16} /> Previsualización de datos
                        </p>
                        <button type="button" className={styles.primaryButton} disabled={!hasPreview || !selectedSupplierId}>
                            Crear / Actualizar artículos
                        </button>
                    </div>

                    {hasPreview ? (
                        <div className={styles.previewTableWrapper}>
                            <table className={styles.previewTable}>
                                <thead>
                                    <tr>
                                        {previewHeaders.map((header) => (
                                            <th key={header}>{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewRows.map((row, index) => (
                                        <tr key={`${row.sku}-${index}`}>
                                            <td>{row.sku}</td>
                                            <td>{row.descriptionSku}</td>
                                            <td>{row.family}</td>
                                            <td>{row.familyDescription}</td>
                                            <td>{row.type}</td>
                                            <td>{row.typeDescription}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className={styles.emptyPreview}>Seleccioná un archivo CSV para mostrar la previsualización de importación.</p>
                    )}
                </section>
            </div>
        </div>
    );
}
