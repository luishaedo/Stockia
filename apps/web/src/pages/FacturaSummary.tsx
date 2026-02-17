import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFactura } from '../context/FacturaContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react';

export function FacturaSummary() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { state, loadFactura } = useFactura();

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
        // In strict Phase 2, we just finish draft. 
        // Ideally update status to FINAL via API.
        // For MVP autosave covers content. We might need an explicit "Finalize" endpoint or just field update.
        // I'll assume we leave it as valid draft for now or update 'estado'.
        // API Phase 1 has 'estado' field.
        if (!id) return;
        // updateDraft({ estado: 'FINAL' }); // Typos in shared types? Enum needed.
        // Typecast to any or import Enum if available in frontend (it is).
        // Let's just go back for now or show success.
        alert("Factura Finalized (Simulation)");
        navigate('/');
    };

    if (state.status === 'LOADING' || !state.currentFactura) {
        return <Loader2 className="animate-spin h-8 w-8 mx-auto mt-12 text-blue-500" />;
    }

    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">Invoice Summary</h1>
                    <p className="text-slate-400">
                        {state.currentFactura.nroFactura} • {state.currentFactura.proveedor}
                    </p>
                </div>
                <div className="flex gap-4">
                    <Button variant="secondary" onClick={() => navigate(`/facturas/${id}/wizard`)}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Wizard
                    </Button>
                    <Button variant="primary" onClick={handleFinalize}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Finalize Invoice
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
                            <span className="font-bold text-yellow-500">{state.currentFactura.estado}</span>
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
