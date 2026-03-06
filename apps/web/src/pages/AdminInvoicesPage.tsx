import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { AdminInvoice, Factura } from '@stockia/shared';
import { api } from '../services/api';

const formatDateTime = (value?: string | Date | null) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(new Date(value));
};

const formatStatus = (status: string) => (status === 'FINAL' ? 'Final' : 'Borrador');

const downloadJson = (invoice: Factura) => {
    const payload = JSON.stringify(invoice, null, 2);
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `factura-${invoice.nroFactura}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export function AdminInvoicesPage() {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
    const [userOptions, setUserOptions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);

    const loadUsers = async (term = '') => {
        try {
            const response = await api.getAdminInvoiceUsers({
                page: 1,
                pageSize: 50,
                search: term || undefined
            });
            setUserOptions(response.items.map((user) => user.externalId));
        } catch {
            setUserOptions([]);
        }
    };

    const loadInvoices = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await api.getAdminInvoices({
                page,
                pageSize,
                from: dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`).toISOString() : undefined,
                to: dateTo ? new Date(`${dateTo}T23:59:59.999Z`).toISOString() : undefined,
                userId: userFilter || undefined,
                search: search.trim() || undefined
            });

            setInvoices(response.items);
            setTotal(response.pagination.total);
            setTotalPages(Math.max(1, response.pagination.totalPages));
        } catch (err: any) {
            setError(err.message || 'No pudimos cargar facturas admin.');
        } finally {
            setLoading(false);
        }
    };

    const deleteInvoice = async (invoiceId: string) => {
        if (!window.confirm('¿Seguro que querés eliminar esta factura?')) {
            return;
        }

        setBusyInvoiceId(invoiceId);
        try {
            await api.deleteAdminInvoice(invoiceId);
            await loadInvoices();
        } catch (err: any) {
            setError(err.message || 'No pudimos eliminar la factura.');
        } finally {
            setBusyInvoiceId(null);
        }
    };

    const exportInvoice = async (invoiceId: string) => {
        setBusyInvoiceId(invoiceId);
        try {
            const factura = await api.getFactura(invoiceId);
            downloadJson(factura);
            await api.exportAdminInvoice(invoiceId);
            await loadInvoices();
        } catch (err: any) {
            setError(err.message || 'No pudimos exportar la factura.');
        } finally {
            setBusyInvoiceId(null);
        }
    };

    useEffect(() => {
        void loadInvoices();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page]);

    useEffect(() => {
        void loadUsers(userFilter);
    }, [userFilter]);

    const usersForAutocomplete = useMemo(() => Array.from(new Set(userOptions)), [userOptions]);

    return (
        <div className="space-y-6">
            <Card>
                <h1 className="text-2xl font-bold mb-2">Admin · Facturas</h1>
                <p className="text-slate-300">Podés buscar, editar, eliminar y exportar facturas. También se muestra quién y cuándo las creó.</p>
            </Card>

            <Card title="Filtros">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                    <Input label="Fecha desde" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                    <Input label="Fecha hasta" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                    <Input label="Buscar" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Número o proveedor" />
                    <div>
                        <Input
                            label="Usuario (opcional)"
                            value={userFilter}
                            onChange={(event) => setUserFilter(event.target.value)}
                            placeholder="Ej: admin"
                            list="admin-invoice-users"
                        />
                        <datalist id="admin-invoice-users">
                            {usersForAutocomplete.map((userId) => (
                                <option key={userId} value={userId} />
                            ))}
                        </datalist>
                    </div>
                    <Button
                        variant="secondary"
                        onClick={() => {
                            setPage(1);
                            void loadInvoices();
                        }}
                    >
                        Aplicar filtros
                    </Button>
                </div>
            </Card>

            <Card>
                {loading && <p className="text-slate-400">Cargando facturas...</p>}
                {error && <p className="text-red-400">{error}</p>}

                {!loading && !error && invoices.length === 0 && (
                    <p className="text-amber-300">No se encontraron facturas para los filtros seleccionados.</p>
                )}

                {!loading && !error && invoices.length > 0 && (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-700">
                                        <th className="text-left p-3 text-slate-400">Número</th>
                                        <th className="text-left p-3 text-slate-400">Proveedor</th>
                                        <th className="text-left p-3 text-slate-400">Estado</th>
                                        <th className="text-left p-3 text-slate-400">Creado por</th>
                                        <th className="text-left p-3 text-slate-400">Alta</th>
                                        <th className="text-left p-3 text-slate-400">Últ. edición</th>
                                        <th className="text-left p-3 text-slate-400">Exportada</th>
                                        <th className="text-left p-3 text-slate-400">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map((invoice) => (
                                        <tr key={invoice.id} className="border-b border-slate-800">
                                            <td className="p-3 text-white font-mono">{invoice.number}</td>
                                            <td className="p-3 text-slate-300">{invoice.supplier || '-'}</td>
                                            <td className="p-3 text-slate-300">{formatStatus(invoice.status)}</td>
                                            <td className="p-3 text-slate-300">{invoice.createdBy?.externalId || '-'}</td>
                                            <td className="p-3 text-slate-400">{formatDateTime(invoice.createdAt)}</td>
                                            <td className="p-3 text-slate-400">{formatDateTime(invoice.updatedAt)}</td>
                                            <td className="p-3 text-slate-400">{formatDateTime(invoice.exportedAt)}</td>
                                            <td className="p-3 text-slate-300">
                                                <div className="flex flex-wrap gap-2">
                                                    <Button size="sm" variant="ghost" onClick={() => navigate(`/facturas/${invoice.id}/wizard`)}>
                                                        Editar
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        disabled={busyInvoiceId === invoice.id}
                                                        onClick={() => {
                                                            void exportInvoice(invoice.id);
                                                        }}
                                                    >
                                                        Exportar
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        disabled={busyInvoiceId === invoice.id}
                                                        onClick={() => {
                                                            void deleteInvoice(invoice.id);
                                                        }}
                                                    >
                                                        Eliminar
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
                            <p className="text-sm text-slate-400">Página {page} de {totalPages} ({total} registros)</p>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>Anterior</Button>
                                <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((prev) => prev + 1)}>Siguiente</Button>
                            </div>
                        </div>
                    </>
                )}
            </Card>
        </div>
    );
}
