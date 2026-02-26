import { useState } from 'react';
import { VarianteColor } from '@stockia/shared';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Plus, Check, Trash2 } from 'lucide-react';

interface ColorStepProps {
    itemContext: {
        supplierLabel: string;
        marca?: string;
        tipoPrenda: string;
        codigoArticulo: string;
        curvaTalles: string[];
    };
    addedColors: VarianteColor[];
    onAddColor: (color: VarianteColor) => void;
    onRemoveColor: (index: number) => void;
    onFinishItem: () => void;
    onBack: () => void;
    readOnly?: boolean;
}

export function ColorStep({
    itemContext,
    addedColors,
    onAddColor,
    onRemoveColor,
    onFinishItem,
    onBack,
    readOnly = false
}: ColorStepProps) {
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [error, setError] = useState('');

    const handleQtyChange = (size: string, val: string) => {
        const num = parseInt(val) || 0;
        setQuantities(prev => ({ ...prev, [size]: num }));
    };

    const handleAddColor = () => {
        if (!code || !name) {
            setError('El código y el nombre del color son obligatorios.');
            return;
        }

        const hasQuantity = Object.values(quantities).some(q => q > 0);
        if (!hasQuantity) {
            setError('Al menos un talle debe tener una cantidad mayor a 0.');
            return;
        }

        if (addedColors.some(c => c.codigoColor === code)) {
            setError('El código de color ya fue agregado en este ítem.');
            return;
        }

        const validQuantities = Object.fromEntries(
            Object.entries(quantities).filter(([key]) => itemContext.curvaTalles.includes(key))
        );

        onAddColor({
            codigoColor: code,
            nombreColor: name,
            cantidadesPorTalle: validQuantities
        });

        setCode('');
        setName('');
        setQuantities({});
        setError('');
    };

    return (
        <div className="flex flex-col gap-4 sm:gap-6 max-w-4xl mx-auto">
            <Card className="bg-slate-800 border-slate-700">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                    <div>
                        <h2 className="text-lg font-bold text-white">{itemContext.supplierLabel || itemContext.marca || "-"} - {itemContext.tipoPrenda}</h2>
                        <p className="text-slate-400">Código: {itemContext.codigoArticulo}</p>
                    </div>
                    <div className="text-left sm:text-right">
                        <span className="text-sm text-slate-500">Curva: {itemContext.curvaTalles.join(', ')}</span>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <Card title="Agregar variante de color">
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <Input
                                label="Código de color"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="Ej: 001"
                                disabled={readOnly}
                            />
                            <Input
                                label="Nombre de color"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ej: Negro"
                                disabled={readOnly}
                            />
                        </div>

                        <div className="mt-1">
                            <label className="text-sm font-medium text-slate-400 mb-2 block">Cantidades por talle</label>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {itemContext.curvaTalles.map(size => (
                                    <div key={size} className="flex flex-col">
                                        <span className="text-xs text-center text-slate-500 mb-1">{size}</span>
                                        <Input
                                            type="number"
                                            min="0"
                                            className="text-center"
                                            value={quantities[size] || ''}
                                            onChange={(e) => handleQtyChange(size, e.target.value)}
                                            disabled={readOnly}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {error && <p className="text-red-500 text-sm">{error}</p>}

                        <Button onClick={handleAddColor} variant="secondary" className="mt-2 w-full sm:w-auto" icon={<Plus className="h-4 w-4" />} disabled={readOnly}>
                            Agregar variante
                        </Button>
                    </div>
                </Card>

                <Card title={`Variantes agregadas (${addedColors.length})`}>
                    <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                        {addedColors.length === 0 && (
                            <p className="text-slate-500 text-center py-8">Todavía no agregaste colores.</p>
                        )}

                        {addedColors.map((color, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/50 rounded border border-slate-700">
                                <div>
                                    <div className="font-bold text-sm text-white">{color.nombreColor} ({color.codigoColor})</div>
                                    <div className="text-xs text-slate-400 mt-1">
                                        {Object.entries(color.cantidadesPorTalle)
                                            .filter(([_, q]) => Number(q) > 0)
                                            .map(([s, q]) => `${s}: ${q}`)
                                            .join(', ')}
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-400 hover:text-red-300"
                                    onClick={() => onRemoveColor(idx)}
                                    disabled={readOnly}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-700 flex flex-col sm:flex-row gap-2 sm:justify-between">
                        <Button variant="ghost" onClick={onBack} className="w-full sm:w-auto">Volver al artículo</Button>
                        <Button
                            onClick={onFinishItem}
                            disabled={addedColors.length === 0 || readOnly}
                            variant="primary"
                            icon={<Check className="h-4 w-4" />}
                            className="w-full sm:w-auto"
                        >
                            Guardar ítem
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
}
