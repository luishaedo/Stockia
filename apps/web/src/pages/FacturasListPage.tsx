import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FacturaFilters, FacturaListResponse } from '@stockia/shared';
import { ClipboardList, FilePlus2, Search, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { PendingTasksList } from '../components/home/PendingTasksList';
import { QuickActionsGrid } from '../components/home/QuickActionsGrid';
import styles from './FacturasListPage.module.css';

export function FacturasListPage() {
    const navigate = useNavigate();
    const [data, setData] = useState<FacturaListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState<FacturaFilters>({
        page: 1,
        pageSize: 6,
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

    const quickActions = [
        { key: 'new', label: 'Nueva', icon: FilePlus2, onClick: () => navigate('/facturas/new') },
        { key: 'catalogs', label: 'Catálogos', icon: ClipboardList, onClick: () => navigate('/admin') },
        { key: 'articles', label: 'Artículos', icon: ShieldCheck, onClick: () => navigate('/articulos') },
        { key: 'search', label: 'Buscar', icon: Search, onClick: () => navigate('/buscar') }
    ];

    const taskItems = useMemo(() => data?.items ?? [], [data?.items]);

    return (
        <section>
            <header className={styles.hero}>
                <div>
                    <h1 className={styles.brand}>Stockia</h1>
                    <p className={styles.subtitle}>Gestión de facturas</p>
                </div>
                <QuickActionsGrid items={quickActions} />
            </header>

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
                            <button
                                type="button"
                                className={styles.pageButton}
                                onClick={() => setFilters({ ...filters, page: Math.max(1, (filters.page || 1) - 1) })}
                                disabled={(filters.page || 1) <= 1}
                            >
                                Anterior
                            </button>
                            <p className={styles.pageInfo}>Página {data.pagination.page} de {data.pagination.totalPages}</p>
                            <button
                                type="button"
                                className={styles.pageButton}
                                onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                                disabled={data.pagination.page >= data.pagination.totalPages}
                            >
                                Siguiente
                            </button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
