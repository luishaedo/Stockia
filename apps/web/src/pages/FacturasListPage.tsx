import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { FacturaFilters, Factura, FacturaEstado, FacturaListResponse } from '@stockia/shared';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { FileText, Search } from 'lucide-react';

export function FacturasListPage() {
    const navigate = useNavigate();
    const [data, setData] = useState<FacturaListResponse | null>(null);
    const [loading, setLoading] = useState(false);
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
            console.error('Failed to load facturas:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadFacturas();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.page, filters.pageSize, filters.sortBy, filters.sortDir]);

    const handleSearch = () => {
        setFilters({ ...filters, page: 1 });
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
        <div className="max-w-6xl mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white">Invoices</h1>
                <Button onClick={() => navigate('/facturas/new')} icon={<FileText className="h-4 w-4" />}>
                    New Invoice
                </Button>
            </div>

            <Card title="Filters" className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Input
                        label="Invoice Number"
                        value={filters.nroFactura || ''}
                        onChange={(e) => setFilters({ ...filters, nroFactura: e.target.value })}
                        placeholder="e.g. A-001"
                    />
                    <Input
                        label="Provider"
                        value={filters.proveedor || ''}
                        onChange={(e) => setFilters({ ...filters, proveedor: e.target.value })}
                        placeholder="e.g. Nike"
                    />
                    <div>
                        <label className="text-sm font-medium text-slate-400 block mb-1">Status</label>
                        <select
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-purple-500"
                            value={filters.estado || ''}
                            onChange={(e) => setFilters({ ...filters, estado: (e.target.value as FacturaEstado) || undefined })}
                        >
                            <option value="">All</option>
                            <option value="DRAFT">Draft</option>
                            <option value="FINAL">Final</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <Button onClick={handleSearch} variant="secondary" icon={<Search className="h-4 w-4" />}>
                            Search
                        </Button>
                    </div>
                </div>
            </Card>

            {loading && <p className="text-center text-slate-400">Loading...</p>}

            {!loading && data && (
                <Card>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-700">
                                    <th className="text-left p-3 text-slate-400 font-medium">Nro</th>
                                    <th className="text-left p-3 text-slate-400 font-medium">Provider</th>
                                    <th className="text-left p-3 text-slate-400 font-medium">Date</th>
                                    <th className="text-left p-3 text-slate-400 font-medium">Status</th>
                                    <th className="text-left p-3 text-slate-400 font-medium">Items</th>
                                    <th className="text-right p-3 text-slate-400 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map((factura) => (
                                    <tr key={factura.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                                        <td className="p-3 text-white font-mono">{factura.nroFactura}</td>
                                        <td className="p-3 text-slate-300">{factura.proveedor || '-'}</td>
                                        <td className="p-3 text-slate-400">{new Date(factura.fecha).toLocaleDateString()}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusClass(factura.estado)}`}>
                                                {factura.estado}
                                            </span>
                                        </td>
                                        <td className="p-3 text-slate-400">{factura.items?.length || 0}</td>
                                        <td className="p-3 text-right">
                                            <Button size="sm" onClick={() => handleOpenFactura(factura)}>
                                                {isFinal(factura.estado) ? 'View' : 'Edit'}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {data.pagination && (
                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-700">
                            <p className="text-sm text-slate-400">
                                Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total)
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={data.pagination.page === 1}
                                    onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                                >
                                    Previous
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={data.pagination.page >= data.pagination.totalPages}
                                    onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}
