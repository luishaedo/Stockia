import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Search, X } from 'lucide-react';
import { ApiError, api } from '../../services/api';
import styles from './SupplierCreateModal.module.css';

type CreatedSupplier = {
    id: string;
    code: string;
    name: string;
    logoUrl?: string | null;
};

interface SupplierCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (supplier: CreatedSupplier) => void;
}

export function SupplierCreateModal({ isOpen, onClose, onCreated }: SupplierCreateModalProps) {
    const [query, setQuery] = useState('');
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [suppliers, setSuppliers] = useState<Array<{ id: string; code?: string; label: string; logoUrl?: string | null }>>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [failedSupplierLogos, setFailedSupplierLogos] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setSelectedSupplierId('');
            setSuppliers([]);
            setFailedSupplierLogos({});
            setError(null);
            setLoading(false);
            setSaving(false);
            return;
        }

        const loadSuppliers = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await api.getOperationsCatalogs(true);
                setSuppliers(response.suppliers.map((supplier: { id: string; code?: string; label: string; logoUrl?: string | null }) => ({
                    id: supplier.id,
                    code: supplier.code,
                    label: supplier.label,
                    logoUrl: supplier.logoUrl ? api.resolveAssetUrl(supplier.logoUrl) : null
                })));
            } catch (err) {
                if (err instanceof ApiError) {
                    setError(`${err.message} [${err.code}]`);
                } else if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError('No pudimos cargar proveedores.');
                }
            } finally {
                setLoading(false);
            }
        };

        void loadSuppliers();
    }, [isOpen]);

    if (!isOpen) return null;

    const filteredSuppliers = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return suppliers;
        return suppliers.filter((supplier) => (
            supplier.label.toLowerCase().includes(normalizedQuery)
            || (supplier.code ?? '').toLowerCase().includes(normalizedQuery)
        ));
    }, [query, suppliers]);

    const handleConfirm = async () => {
        const selectedSupplier = suppliers.find((supplier) => supplier.id === selectedSupplierId);
        if (!selectedSupplier) {
            setError('Seleccioná un proveedor existente.');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            onCreated({
                id: selectedSupplier.id,
                code: selectedSupplier.code ?? '',
                name: selectedSupplier.label,
                logoUrl: selectedSupplier.logoUrl
            });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.overlay} role="presentation" onClick={onClose}>
            <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="create-supplier-title" onClick={(event) => event.stopPropagation()}>
                <div className={styles.header}>
                    <div>
                        <h2 id="create-supplier-title">Seleccionar proveedor</h2>
                        <p>Elegí un proveedor existente para esta factura.</p>
                    </div>
                    <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Cerrar modal">
                        <X size={18} />
                    </button>
                </div>

                <div className={styles.searchBar}>
                    <Search size={16} />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar proveedor"
                        disabled={saving || loading}
                    />
                </div>

                <div className={styles.list} role="listbox" aria-label="Lista de proveedores">
                    {filteredSuppliers.map((supplier) => {
                        const active = selectedSupplierId === supplier.id;
                        return (
                            <button
                                key={supplier.id}
                                type="button"
                                className={active ? styles.supplierCardActive : styles.supplierCard}
                                onClick={() => setSelectedSupplierId(supplier.id)}
                                disabled={saving}
                            >
                                {active && <CheckCircle2 size={16} className={styles.checkIcon} />}
                                {supplier.logoUrl && !failedSupplierLogos[supplier.id] ? (
                                    <img
                                        src={supplier.logoUrl}
                                        alt={supplier.label}
                                        className={styles.supplierLogo}
                                        onError={() => setFailedSupplierLogos((prev) => ({ ...prev, [supplier.id]: true }))}
                                    />
                                ) : (
                                    <span className={styles.supplierAvatar}>{supplier.label.charAt(0).toUpperCase()}</span>
                                )}
                                <div className={styles.supplierMeta}>
                                    <strong>{supplier.label}</strong>
                                    <span>{supplier.code || 'Sin código'}</span>
                                </div>
                            </button>
                        );
                    })}
                    {!loading && filteredSuppliers.length === 0 && (
                        <div className={styles.emptyState}>
                            <AlertCircle size={16} />
                            <span>No encontramos proveedores con ese criterio.</span>
                        </div>
                    )}
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <div className={styles.actions}>
                    <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={saving}>Cancelar</button>
                    <button type="button" className={styles.primaryButton} onClick={() => void handleConfirm()} disabled={saving || !selectedSupplierId}>
                        {saving ? 'Guardando...' : 'Seleccionar proveedor'}
                    </button>
                </div>
            </div>
        </div>
    );
}
