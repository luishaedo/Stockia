import { useState } from 'react';
import { VarianteColor } from '@stockia/shared';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Plus, Check, Trash2 } from 'lucide-react';

interface ColorStepProps {
    itemContext: {
        marca: string;
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

    // Local state for the "New Color" being added
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
            setError('Color code and name are required');
            return;
        }

        const hasQuantity = Object.values(quantities).some(q => q > 0);
        if (!hasQuantity) {
            setError('At least one size must have a quantity > 0');
            return;
        }

        // Check duplicate color in current session
        if (addedColors.some(c => c.codigoColor === code)) {
            setError('Color code already added for this item');
            return;
        }

        // Filter quantities to ensure only valid curve keys are sent
        const validQuantities = Object.fromEntries(
            Object.entries(quantities).filter(([key]) =>
                itemContext.curvaTalles.includes(key)
            )
        );

        onAddColor({
            codigoColor: code,
            nombreColor: name,
            cantidadesPorTalle: validQuantities
        });

        // Reset form
        setCode('');
        setName('');
        setQuantities({});
        setError('');
    };

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto">
            {/* Header Context */}
            <Card className="bg-slate-800 border-slate-700">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-lg font-bold text-white">{itemContext.marca} - {itemContext.tipoPrenda}</h2>
                        <p className="text-slate-400">Code: {itemContext.codigoArticulo}</p>
                    </div>
                    <div className="text-right">
                        <span className="text-sm text-slate-500">Curva: {itemContext.curvaTalles.join(', ')}</span>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Add New Color Form */}
                <Card title="Add Color Variant">
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Color Code"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="e.g. 001"
                                disabled={readOnly}
                            />
                            <Input
                                label="Color Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Black"
                                disabled={readOnly}
                            />
                        </div>

                        <div className="mt-2">
                            <label className="text-sm font-medium text-slate-400 mb-2 block">Quantities per Size</label>
                            <div className="grid grid-cols-4 gap-2">
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

                        <Button onClick={handleAddColor} variant="secondary" className="mt-2" icon={<Plus className="h-4 w-4" />} disabled={readOnly}>
                            Add Variant
                        </Button>
                    </div>
                </Card>

                {/* Right: Added Colors List */}
                <Card title={`Added Variants (${addedColors.length})`}>
                    <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                        {addedColors.length === 0 && (
                            <p className="text-slate-500 text-center py-8">No colors added yet.</p>
                        )}

                        {addedColors.map((color, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/50 rounded border border-slate-700">
                                <div>
                                    <div className="font-bold text-sm text-white">{color.nombreColor} ({color.codigoColor})</div>
                                    <div className="text-xs text-slate-400 mt-1">
                                        {Object.entries(color.cantidadesPorTalle)
                                            .filter(([_, q]) => q > 0)
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

                    <div className="mt-6 pt-4 border-t border-slate-700 flex justify-between">
                        <Button variant="ghost" onClick={onBack}>Back to Article</Button>
                        <Button
                            onClick={onFinishItem}
                            disabled={addedColors.length === 0 || readOnly}
                            variant="primary"
                            icon={<Check className="h-4 w-4" />}
                        >
                            Finish Item
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
}
