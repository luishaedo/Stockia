import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFactura } from '../context/FacturaContext';
import { api, ApiError } from '../services/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Loader2, ArrowLeft, CheckCircle, Download } from 'lucide-react';
import { FacturaEstado } from '@stockia/shared';

const formatNumber = (value: number) => new Intl.NumberFormat('es-AR').format(value);
const getEstadoLabel = (estado: string) => (estado === 'FINAL' ? 'Final' : 'Borrador');

function exportToCSV(factura: any) {
    const rows: string[][] = [['ID', 'Nro', 'Proveedor', 'Fecha', 'Código artículo', 'Marca', 'Tipo', 'Código color', 'Nombre color', 'Talle', 'Cantidad']];

    factura.items.forEach((item: any) => {
        item.colores.forEach((color: any) => {
            Object.entries(color.cantidadesPorTalle).forEach(([size, qty]) => {
                rows.push([
                    factura.id,
                    factura.nroFactura,
                    factura.proveedor || '',
                    new Date(factura.fecha).toLocaleDateString('es-AR'),
                    item.codigoArticulo,
                    item.supplierLabel || item.marca || '',
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
    link.download = `factura_${factura.nroFactura}_${Date.now()}.csv`;
    link.click();
}

export function FacturaSummary() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { state, loadFactura } = useFactura();
    const [finalizing, setFinalizing] = useState(false);

    const currentFacturaId = state.currentFactura?.id;

    useEffect(() => {
        if (id && currentFacturaId !== id) {
            loadFactura(id);
        }
    }, [id, currentFacturaId, loadFactura]);

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
            alert('La factura ya está finalizada.');
            return;
        }

        const confirmed = window.confirm('¿Seguro que querés finalizar esta factura? Esta acción no se puede deshacer.');
        if (!confirmed) return;

        setFinalizing(true);
        try {
            await api.finalizeFactura(id, state.currentFactura.updatedAt as string);
            await loadFactura(id);
            alert('Factura finalizada correctamente.');
        } catch (error: unknown) {
            if (error instanceof ApiError) {
                console.error('Finalize factura failed', {
                    code: error.code,
                    status: error.status,
                    traceId: error.traceId,
                    details: error.details
                });
                const trace = error.traceId ? ` | traceId: ${error.traceId}` : '';
                alert(`No se pudo finalizar la factura: ${error.message} [${error.code} - ${error.status}]${trace}`);
            } else if (error instanceof Error) {
                console.error('Finalize factura failed', error);
                alert(`No se pudo finalizar la factura: ${error.message}`);
            } else {
                console.error('Finalize factura failed', error);
                alert('No se pudo finalizar la factura: Error desconocido');
            }
        }
        setFinalizing(false);
    };

    if (state.isLoading || !state.currentFactura) {
        return <Loader2 className="animate-spin h-8 w-8 mx-auto mt-12 text-blue-500" />;
    }

    const isFinal = state.currentFactura.estado === FacturaEstado.FINAL;

    return (
        <div className="flex flex-col gap-4 sm:gap-6 max-w-5xl mx-auto pb-8">
            {isFinal && (
                <div className="bg-green-500/10 border border-green-500/50 rounded p-4 flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <span className="text-green-400 font-medium">Esta factura está finalizada y es de solo lectura.</span>
                </div>
            )}

            <div className="flex flex-col gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white">Resumen de factura</h1>
                    <p className="text-slate-400">{state.currentFactura.nroFactura} • {state.currentFactura.proveedor || 'Sin proveedor'}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <Button variant="ghost" onClick={() => navigate('/facturas')} className="w-full sm:w-auto">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Volver al listado
                    </Button>
                    {!isFinal && (
                        <>
                            <Button variant="secondary" onClick={() => navigate(`/facturas/${id}/wizard`)} className="w-full sm:w-auto">
                                Editar
                            </Button>
                            <Button variant="primary" onClick={handleFinalize} isLoading={finalizing} className="w-full sm:w-auto">
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Finalizar
                            </Button>
                        </>
                    )}
                    <Button variant="secondary" onClick={() => exportToCSV(state.currentFactura)} className="w-full sm:w-auto sm:ml-auto">
                        <Download className="h-4 w-4 mr-2" />
                        Exportar CSV
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                <Card title="Resumen" className="md:col-span-1 h-fit order-1">
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between">
                            <span className="text-slate-400">Total de ítems</span>
                            <span className="font-bold text-xl">{formatNumber(stats.items)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Total de unidades</span>
                            <span className="font-bold text-xl">{formatNumber(stats.units)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Estado</span>
                            <span className={`font-bold ${isFinal ? 'text-green-400' : 'text-yellow-400'}`}>
                                {getEstadoLabel(state.currentFactura.estado)}
                            </span>
                        </div>
                    </div>
                </Card>

                <Card title="Detalle de ítems" className="md:col-span-2 order-2">
                    <div className="flex flex-col gap-4">
                        {state.currentFactura.items.length === 0 && (
                            <p className="text-slate-500 text-center">No hay ítems cargados.</p>
                        )}
                        {state.currentFactura.items.map((item, idx) => (
                            <div key={idx} className="bg-slate-800/50 p-4 rounded border border-slate-700">
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-1">
                                    <h3 className="font-bold text-white">{item.supplierLabel || item.marca || "-"} - {item.tipoPrenda}</h3>
                                    <span className="text-xs text-slate-500">{item.codigoArticulo}</span>
                                </div>
                                <div className="flex flex-col gap-2 pl-3 border-l-2 border-slate-700">
                                    {item.colores.map((color, cIdx) => (
                                        <div key={cIdx} className="text-sm">
                                            <span className="text-blue-300 font-medium">{color.nombreColor} ({color.codigoColor}):</span>
                                            <span className="ml-2 text-slate-400">
                                                {Object.entries(color.cantidadesPorTalle)
                                                    .filter(([_, q]) => Number(q) > 0)
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
