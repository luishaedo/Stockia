import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FacturaEstado, FacturaFilters, FacturaListResponse } from '@stockia/shared';
import { ClipboardList, FileSearch, FileText, Shapes } from 'lucide-react';
import { ApiError, api } from '../services/api';
import { PendingTasksList } from '../components/home/PendingTasksList';
import { QuickActionsGrid } from '../components/home/QuickActionsGrid';
import styles from './FacturasListPage.module.css';


export function FacturasListPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [data, setData] = useState<FacturaListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [supplierOptions, setSupplierOptions] = useState<Array<{ code: string; name: string }>>([]);
    const [supplierOptionsError, setSupplierOptionsError] = useState<string | null>(null);
    const [filters, setFilters] = useState<FacturaFilters>({
        page: 1,
        pageSize: 5,
        sortBy: 'fecha',
        sortDir: 'desc'
    });

    const loadFacturas = async () => {
        setLoading(true);
        try {
            const result = await api.getFacturas(filters);
            setData(result);
        } catch (error: any) {
            console.error('Error loading invoices:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        void loadFacturas();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.page, filters.pageSize, filters.sortBy, filters.sortDir]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('openSearch') === 'true') {
            setIsFilterPanelOpen(true);
        }
    }, [location.search]);

    useEffect(() => {
        const loadSuppliers = async () => {
            try {
                const suppliers = await api.getAdminCatalogCached<Array<{ code: string; name: string }>>('suppliers');
                setSupplierOptions(suppliers);
                setSupplierOptionsError(null);
            } catch (error) {
                const message = error instanceof ApiError ? error.message : 'No pudimos cargar proveedores para filtros.';
                setSupplierOptionsError(message);
            }
        };

        void loadSuppliers();
    }, []);

    const quickActions = [
        { key: 'new', label: 'Nueva', icon: FileText, onClick: () => navigate('/facturas/new') },
        { key: 'search', label: 'Buscar', icon: FileSearch, onClick: () => setIsFilterPanelOpen((value) => !value) },
        { key: 'catalogs', label: 'Catalogos', icon: ClipboardList, onClick: () => navigate('/admin') },
        { key: 'articles', label: 'Artículos', icon: Shapes, onClick: () => {} }
    ];

    const taskItems = useMemo(() => data?.items ?? [], [data?.items]);

    return (
        <section className={styles.page}>
            <h1 className={styles.welcome}>home</h1>

            <QuickActionsGrid items={quickActions} />

            {isFilterPanelOpen && (
                <div className={styles.filterPanel}>
                    <div className={styles.filterGrid}>
                        <div>
                            <label className={styles.fieldLabel}>Nro. factura</label>
                            <input
                                className={styles.input}
                                value={filters.nroFactura || ''}
                                onChange={(event) => setFilters({ ...filters, nroFactura: event.target.value })}
                                placeholder="Ej: A-001"
                            />
                        </div>
                        <div>
                            <label className={styles.fieldLabel}>Proveedor</label>
                            <input
                                className={styles.input}
                                value={filters.proveedor || ''}
                                onChange={(event) => setFilters({ ...filters, proveedor: event.target.value })}
                                placeholder="Seleccioná proveedor"
                                list="invoice-filter-supplier-options"
                            />
                            <datalist id="invoice-filter-supplier-options">
                                {supplierOptions.map((supplier) => (
                                    <option key={supplier.code} value={supplier.name}>{supplier.code} - {supplier.name}</option>
                                ))}
                            </datalist>
                            {supplierOptionsError && <p className={styles.errorText}>{supplierOptionsError}</p>}
                        </div>
                        <div>
                            <label className={styles.fieldLabel}>Estado</label>
                            <select
                                className={styles.select}
                                value={filters.estado || ''}
                                onChange={(event) => setFilters({ ...filters, estado: (event.target.value as FacturaEstado) || undefined })}
                            >
                                <option value="">Todos</option>
                                <option value={FacturaEstado.DRAFT}>Borrador</option>
                                <option value={FacturaEstado.FINAL}>Final</option>
                            </select>
                        </div>
                    </div>
                    <div className={styles.filterActions}>
                        <button
                            type="button"
                            className={`${styles.controlButton} ${styles.primaryButton}`}
                            onClick={() => {
                                setFilters({ ...filters, page: 1 });
                                void loadFacturas();
                            }}
                        >
                            Buscar
                        </button>
                        <button
                            type="button"
                            className={`${styles.controlButton} ${styles.secondaryButton}`}
                            onClick={() => {
                                setFilters({ page: 1, pageSize: 5, sortBy: 'fecha', sortDir: 'desc' });
                                void loadFacturas();
                            }}
                        >
                            Limpiar
                        </button>
                    </div>
                </div>
            )}

            {loading && <p className={styles.loading}>Cargando facturas...</p>}

            {!loading && data && (
                <>
                    <PendingTasksList
                        items={taskItems}
                        onOpenDraft={(factura) => navigate(`/facturas/${factura.id}/wizard`)}
                        onOpenSummary={(factura) => navigate(`/facturas/${factura.id}/summary`)}
                    />

                    {data.pagination && data.pagination.totalPages > 1 && (
                        <div className={styles.pagination}>
                            {data.pagination.page > 1 && (
                                <button
                                    type="button"
                                    className={`${styles.controlButton} ${styles.secondaryButton}`}
                                    onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                                >
                                    Anterior
                                </button>
                            )}
                            <p className={styles.pageInfo}>
                                Página {data.pagination.page} de {data.pagination.totalPages}
                            </p>
                            {data.pagination.page < data.pagination.totalPages && (
                                <button
                                    type="button"
                                    className={`${styles.controlButton} ${styles.secondaryButton}`}
                                    onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                                >
                                    Siguiente
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
