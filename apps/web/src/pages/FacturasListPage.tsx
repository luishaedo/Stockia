import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Factura, FacturaEstado, FacturaFilters, FacturaListResponse } from '@stockia/shared';
import { FileSearch, FileText, Search } from 'lucide-react';
import { ApiError, api } from '../services/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

const formatDate = (date: string | Date) => new Intl.DateTimeFormat('es-AR').format(new Date(date));
const getEstadoLabel = (estado: string) => (estado === 'FINAL' ? 'Final' : 'Borrador');
const isFinal = (estado: string) => estado === 'FINAL';

export function FacturasListPage() {
    const navigate = useNavigate();
    const [data, setData] = useState<FacturaListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [supplierOptions, setSupplierOptions] = useState<Array<{ code: string; name: string }>>([]);
    const [supplierOptionsError, setSupplierOptionsError] = useState<string | null>(null);
    const [filters, setFilters] = useState<FacturaFilters>({
        page: 1,
        pageSize: 20,
        sortBy: 'fecha',
        sortDir: 'desc'
    });

    const loadFacturas = async () => {
        setLoading(true);
        try {
            const result = await api.getFacturas(filters);
            setData(result);
        } catch (error: any) {
            console.error('Error al cargar facturas:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        void loadFacturas();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.page, filters.pageSize, filters.sortBy, filters.sortDir]);

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

    const handleSearch = () => {
        setFilters({ ...filters, page: 1 });
        void loadFacturas();
    };

    const handleOpenFactura = (factura: Factura) => {
        if (factura.estado === FacturaEstado.FINAL) {
            navigate(`/facturas/${factura.id}/summary`);
            return;
        }
        navigate(`/facturas/${factura.id}/wizard`);
    };

    const pendingInvoices = useMemo(
        () => (data?.items || []).filter((factura) => !isFinal(factura.estado)),
        [data?.items]
    );

    const getStatusClass = (estado: string) => (
        isFinal(estado)
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
    );

    return (
        <div className="mx-auto w-full max-w-6xl px-3 py-4 pb-24 sm:px-4 sm:py-6 sm:pb-8">
            <div className="mb-6 rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4 sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-white sm:text-3xl">Facturas</h1>
                        <p className="mt-2 text-sm text-slate-400">Creá, retomá y buscá facturas desde una experiencia más simple.</p>
                    </div>
                    <Button
                        type="button"
                        variant="secondary"
                        className="h-11 min-w-11 rounded-full px-0"
                        icon={<Search className="h-4 w-4" />}
                        title={isFilterPanelOpen ? 'Ocultar filtros de búsqueda' : 'Mostrar filtros de búsqueda'}
                        aria-label={isFilterPanelOpen ? 'Ocultar filtros de búsqueda' : 'Mostrar filtros de búsqueda'}
                        onClick={() => setIsFilterPanelOpen((prev) => !prev)}
                    />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => navigate('/facturas/new')}
                        className="group flex min-h-24 items-center gap-3 rounded-2xl border border-slate-600 bg-gradient-to-r from-slate-800/90 via-slate-800 to-slate-700 p-4 text-left transition-all hover:border-purple-400 hover:shadow-lg hover:shadow-purple-900/30"
                    >
                        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-500 bg-slate-900/70 text-purple-300 transition-colors group-hover:border-purple-300 group-hover:text-purple-200">
                            <FileText className="h-6 w-6" />
                        </span>
                        <span>
                            <span className="block text-base font-semibold text-white">Nueva factura</span>
                            <span className="text-xs text-slate-300">Comenzar carga desde cero</span>
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsFilterPanelOpen((prev) => !prev)}
                        className="group flex min-h-24 items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-left transition-all hover:border-slate-500 hover:bg-slate-800"
                    >
                        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-600 bg-slate-900/60 text-slate-300 transition-colors group-hover:text-white">
                            <FileSearch className="h-6 w-6" />
                        </span>
                        <span>
                            <span className="block text-base font-semibold text-white">Buscar facturas</span>
                            <span className="text-xs text-slate-300">Ver filtros por número, proveedor o estado</span>
                        </span>
                    </button>
                </div>

                <div
                    className={`grid transition-all duration-300 ease-in-out ${isFilterPanelOpen ? 'mt-5 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'}`}
                    aria-hidden={!isFilterPanelOpen}
                >
                    <div className="overflow-hidden">
                        <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <Input
                                    label="Nro. factura"
                                    value={filters.nroFactura || ''}
                                    onChange={(e) => setFilters({ ...filters, nroFactura: e.target.value })}
                                    placeholder="Ej: A-001"
                                />
                                <div>
                                    <Input
                                        label="Proveedor"
                                        value={filters.proveedor || ''}
                                        onChange={(e) => setFilters({ ...filters, proveedor: e.target.value })}
                                        placeholder="Seleccioná proveedor"
                                        list="invoice-filter-supplier-options"
                                    />
                                    <datalist id="invoice-filter-supplier-options">
                                        {supplierOptions.map((supplier) => (
                                            <option key={supplier.code} value={supplier.name}>{supplier.code} - {supplier.name}</option>
                                        ))}
                                    </datalist>
                                    {supplierOptionsError && <p className="mt-1 text-xs text-amber-300">{supplierOptionsError}</p>}
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-400">Estado</label>
                                    <select
                                        className="h-11 w-full rounded border border-slate-700 bg-slate-800 px-3 text-white focus:border-purple-500 focus:outline-none"
                                        value={filters.estado || ''}
                                        onChange={(e) => setFilters({ ...filters, estado: (e.target.value as FacturaEstado) || undefined })}
                                    >
                                        <option value="">Todos</option>
                                        <option value={FacturaEstado.DRAFT}>Borrador</option>
                                        <option value={FacturaEstado.FINAL}>Final</option>
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <Button onClick={handleSearch} variant="secondary" icon={<Search className="h-4 w-4" />} className="w-full">
                                        Buscar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {!loading && data && pendingInvoices.length > 0 && (
                <Card title="Continuar facturas pendientes" className="mb-5">
                    <div className="flex flex-wrap gap-2">
                        {pendingInvoices.map((factura) => (
                            <button
                                key={factura.id}
                                type="button"
                                onClick={() => navigate(`/facturas/${factura.id}/wizard`)}
                                className="rounded-full border border-slate-600 bg-slate-800/80 px-4 py-2 font-mono text-sm text-white transition-colors hover:border-purple-400 hover:bg-slate-700"
                            >
                                {factura.nroFactura}
                            </button>
                        ))}
                    </div>
                </Card>
            )}

            {loading && <p className="py-6 text-center text-slate-400">Cargando...</p>}

            {!loading && data && (
                <Card>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {data.items.map((factura) => (
                            <button
                                type="button"
                                key={factura.id}
                                onClick={() => handleOpenFactura(factura)}
                                className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-left transition-all hover:border-slate-500 hover:bg-slate-800"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <p className="font-mono text-sm text-white">{factura.nroFactura}</p>
                                    <span className={`rounded px-2 py-1 text-xs font-medium ${getStatusClass(factura.estado)}`}>
                                        {getEstadoLabel(factura.estado)}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm text-slate-300">{factura.proveedor || 'Sin proveedor'}</p>
                                <div className="mt-3 flex justify-between text-xs text-slate-400">
                                    <span>{formatDate(factura.fecha)}</span>
                                    <span>Ítems: {factura.items?.length || 0}</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {data.pagination && (
                        <div className="mt-4 flex flex-col gap-2 border-t border-slate-700 pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-slate-400">
                                Página {data.pagination.page} de {data.pagination.totalPages} ({data.pagination.total} en total)
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="flex-1 sm:flex-none"
                                    disabled={data.pagination.page === 1}
                                    onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="flex-1 sm:flex-none"
                                    disabled={data.pagination.page >= data.pagination.totalPages}
                                    onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                                >
                                    Siguiente
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}
