import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { FacturaFilters, Factura, FacturaEstado, FacturaListResponse } from '@stockia/shared';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { FileText, Search, SlidersHorizontal } from 'lucide-react';

const formatDate = (date: string | Date) => new Intl.DateTimeFormat('es-AR').format(new Date(date));
const getEstadoLabel = (estado: string) => (estado === 'FINAL' ? 'Final' : 'Borrador');

export function FacturasListPage() {
    const navigate = useNavigate();
    const [data, setData] = useState<FacturaListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [showFiltersMobile, setShowFiltersMobile] = useState(false);
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
        loadFacturas();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.page, filters.pageSize, filters.sortBy, filters.sortDir]);

    const handleSearch = () => {
        setFilters({ ...filters, page: 1 });
        loadFacturas();
    };

    const handleOpenFactura = (factura: Factura) => {
        if (factura.estado === FacturaEstado.FINAL) {
            navigate(`/facturas/${factura.id}/summary`);
        } else {
            navigate(`/facturas/${factura.id}/wizard`);
        }
    };

    const isFinal = (estado: string) => estado === 'FINAL';
    const getStatusClass = (estado: string) => isFinal(estado)
        ? 'bg-green-500/20 text-green-400'
        : 'bg-yellow-500/20 text-yellow-400';

    return (
        <div className="max-w-6xl mx-auto px-1 sm:px-4 py-3 sm:py-6 pb-24 sm:pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 sm:mb-6">
                <h1 className="text-2xl font-bold text-white">Facturas</h1>
                <Button className="sm:ml-auto w-full sm:w-auto" onClick={() => navigate('/facturas/new')} icon={<FileText className="h-4 w-4" />}>
                    Nueva factura
                </Button>
            </div>

            <div className="sm:hidden mb-3">
                <Button variant="secondary" className="w-full" onClick={() => setShowFiltersMobile(prev => !prev)} icon={<SlidersHorizontal className="h-4 w-4" />}>
                    {showFiltersMobile ? 'Ocultar filtros' : 'Mostrar filtros'}
                </Button>
            </div>

            <div className={showFiltersMobile ? 'block sm:block' : 'hidden sm:block'}>
                <Card title="Filtros" className="mb-4 sm:mb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <Input
                            label="Nro. factura"
                            value={filters.nroFactura || ''}
                            onChange={(e) => setFilters({ ...filters, nroFactura: e.target.value })}
                            placeholder="Ej: A-001"
                        />
                        <Input
                            label="Proveedor"
                            value={filters.proveedor || ''}
                            onChange={(e) => setFilters({ ...filters, proveedor: e.target.value })}
                            placeholder="Ej: Nike"
                        />
                        <div>
                            <label className="text-sm font-medium text-slate-400 block mb-1">Estado</label>
                            <select
                                className="w-full h-11 px-3 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-purple-500"
                                value={filters.estado || ''}
                                onChange={(e) => setFilters({ ...filters, estado: (e.target.value as FacturaEstado) || undefined })}
                            >
                                <option value="">Todos</option>
                                <option value="DRAFT">Borrador</option>
                                <option value="FINAL">Final</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <Button onClick={handleSearch} variant="secondary" icon={<Search className="h-4 w-4" />} className="w-full">
                                Buscar
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            {loading && <p className="text-center text-slate-400">Cargando...</p>}

            {!loading && data && (
                <Card>
                    <div className="sm:hidden flex flex-col gap-3">
                        {data.items.map((factura) => (
                            <button
                                type="button"
                                key={factura.id}
                                onClick={() => handleOpenFactura(factura)}
                                className="text-left p-4 bg-slate-800/50 rounded border border-slate-700"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <p className="font-mono text-white text-sm">{factura.nroFactura}</p>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusClass(factura.estado)}`}>
                                        {getEstadoLabel(factura.estado)}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-300 mt-1">{factura.proveedor || 'Sin proveedor'}</p>
                                <div className="mt-2 text-xs text-slate-400 flex justify-between">
                                    <span>{formatDate(factura.fecha)}</span>
                                    <span>Ítems: {factura.items?.length || 0}</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-700">
                                    <th className="text-left p-3 text-slate-400 font-medium">Nro</th>
                                    <th className="text-left p-3 text-slate-400 font-medium">Proveedor</th>
                                    <th className="text-left p-3 text-slate-400 font-medium">Fecha</th>
                                    <th className="text-left p-3 text-slate-400 font-medium">Estado</th>
                                    <th className="text-left p-3 text-slate-400 font-medium">Ítems</th>
                                    <th className="text-right p-3 text-slate-400 font-medium">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map((factura) => (
                                    <tr key={factura.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                                        <td className="p-3 text-white font-mono">{factura.nroFactura}</td>
                                        <td className="p-3 text-slate-300">{factura.proveedor || '-'}</td>
                                        <td className="p-3 text-slate-400">{formatDate(factura.fecha)}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusClass(factura.estado)}`}>
                                                {getEstadoLabel(factura.estado)}
                                            </span>
                                        </td>
                                        <td className="p-3 text-slate-400">{factura.items?.length || 0}</td>
                                        <td className="p-3 text-right">
                                            <Button size="sm" onClick={() => handleOpenFactura(factura)}>
                                                {isFinal(factura.estado) ? 'Ver' : 'Editar'}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {data.pagination && (
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mt-4 pt-4 border-t border-slate-700">
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
