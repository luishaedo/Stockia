import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFactura } from '../context/FacturaContext';
import { api } from '../services/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Loader2, ArrowLeft, CheckCircle, Download } from 'lucide-react';
import { FacturaEstado } from '@stockia/shared';

// CSV Export Utility
function exportToCSV(factura: any) {
    const rows: string[][] = [['ID', 'Nro', 'Provider', 'Date', 'Item Code', 'Brand', 'Type', 'Color Code', 'Color Name', 'Size', 'Quantity']];

    factura.items.forEach((item: any) => {
        item.colores.forEach((color: any) => {
            Object.entries(color.cantidadesPorTalle).forEach(([size, qty]) => {
                rows.push([
                    factura.id,
                    factura.nroFactura,
                    factura.proveedor || '',
                    new Date(factura.fecha).toLocaleDateString(),
                    item.codigoArticulo,
                    item.marca,
                    item.tipoPrenda,
                    color.codigoColor,
                    color.nombreColor,
                    size,
                    String(qty)
                ]);
            });
        });
    });

    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `invoice_${factura.nroFactura}_${Date.now()}.csv`;
    link.click();
}

export function FacturaSummary() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { state, loadFactura } = useFactura();
    const [finalizing, setFinalizing] = useState(false);

    useEffect(() => {
        if (id && (!state.currentFactura || state.currentFactura.id !== id)) {
            loadFactura(id);
        }
    }, [id, state.currentFactura, loadFactura]);

    const stats = useMemo(() => {
        if (!state.currentFactura?.items) return { items: 0, units: 0 };
        let units = 0;
        state.currentFactura.items.forEach(item => {
            item.colores.forEach(color => {
                Object.values(color.cantidadesPorTalle).forEach(q => units += q);
            });
        });
        return { items: state.currentFactura.items.length, units };
    }, [state.currentFactura]);

    const handleFinalize = async () => {
        if (!id || !state.currentFactura) return;
        if (state.currentFactura.estado === FacturaEstado.FINAL) {
            alert('Invoice is already finalized');
            return;
        }

        const confirmed = window.confirm('Are you sure you want to finalize this invoice? This action cannot be undone.');
        if (!confirmed) return;

        setFinalizing(true);
        try {
            await api.finalizeFactura(id, state.currentFactura.updatedAt as string);
            await loadFactura(id); // Reload to reflect FINAL state
            alert('Invoice finalized successfully!');
        } catch (error: any) {
            alert(`Finalize failed: ${error.message}`);
        }
        setFinalizing(false);
    };

    const handleExportCSV = () => {
        if (!state.currentFactura) return;
        exportToCSV(state.currentFactura);
    };

    if (state.status === 'LOADING' || !state.currentFactura) {
        return <Loader2 className="animate-spin h-8 w-8 mx-auto mt-12 text-blue-500" />;
    }

    const isFinal = state.currentFactura.estado === FacturaEstado.FINAL;

    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto">
            {isFinal && (
                <div className="bg-green-500/10 border border-green-500/50 rounded p-4 flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <span className="text-green-400 font-medium">This invoice is finalized and read-only</span>
                </div>
            )}

            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">Invoice Summary</h1>
                    <p className="text-slate-400">
                        {state.currentFactura.nroFactura} • {state.currentFactura.proveedor}
                    </p>
                </div>
                <div className="flex gap-4">
                    <Button variant="ghost" onClick={() => navigate('/facturas')}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to List
                    </Button>
                    {!isFinal && (
                        <>
                            <Button variant="secondary" onClick={() => navigate(`/facturas/${id}/wizard`)}>
                                Edit
                            </Button>
                            <Button variant="primary" onClick={handleFinalize} isLoading={finalizing}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Finalize
                            </Button>
                        </>
                    )}
                    <Button variant="secondary" onClick={handleExportCSV}>
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card title="Stats" className="md:col-span-1 h-fit">
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between">
                            <span className="text-slate-400">Total Items</span>
                            <span className="font-bold text-xl">{stats.items}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Total Units</span>
                            <span className="font-bold text-xl">{stats.units}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Status</span>
                            <span className={`font-bold ${isFinal ? 'text-green-400' : 'text-yellow-400'}`}>
                                {state.currentFactura.estado}
                            </span>
                        </div>
                    </div>
                </Card>

                <Card title="Items Details" className="md:col-span-2">
                    <div className="flex flex-col gap-4">
                        {state.currentFactura.items.length === 0 && (
                            <p className="text-slate-500 text-center">No items added.</p>
                        )}
                        {state.currentFactura.items.map((item, idx) => (
                            <div key={idx} className="bg-slate-800/50 p-4 rounded border border-slate-700">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-white">{item.marca} - {item.tipoPrenda}</h3>
                                    <span className="text-xs text-slate-500">{item.codigoArticulo}</span>
                                </div>
                                <div className="flex flex-col gap-2 pl-4 border-l-2 border-slate-700">
                                    {item.colores.map((color, cIdx) => (
                                        <div key={cIdx} className="text-sm">
                                            <span className="text-blue-300 font-medium">{color.nombreColor} ({color.codigoColor}):</span>
                                            <span className="ml-2 text-slate-400">
                                                {Object.entries(color.cantidadesPorTalle)
                                                    .filter(([_, q]) => q > 0)
                                                    .map(([s, q]) => `${s}: ${q}`)
                                                    .join(', ')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}
