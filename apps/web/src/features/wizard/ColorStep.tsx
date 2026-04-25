import { useMemo, useState } from 'react';
import { VarianteColor } from '@stockia/shared';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Check, ArrowLeft, PencilLine, X } from 'lucide-react';
import { QuickCurvesModal } from '../../components/quickCurves/QuickCurvesModal';
import { api, ApiError, SupplierColorRecord } from '../../services/api';
import { useEffect } from 'react';

interface ColorStepProps {
    itemContext: {
        codigoArticulo: string;
        descripcionArticulo: string;
        sizeCurveId: string;
        curvaTalles: string[];
        supplierId: string;
    };
    addedColors: VarianteColor[];
    sizeCurveOptions: Array<{ id: string; code: string; description: string; values: string[] }>;
    onAddColor: (color: VarianteColor) => void;
    onUpdateColor: (index: number, color: VarianteColor) => void;
    onRemoveColor: (index: number) => void;
    onFinishItem: (colorsToPersist: VarianteColor[]) => void;
    onBack: () => void;
    readOnly?: boolean;
}

export function ColorStep({
    itemContext,
    addedColors,
    sizeCurveOptions,
    onAddColor,
    onUpdateColor,
    onRemoveColor,
    onFinishItem,
    onBack,
    readOnly = false
}: ColorStepProps) {
    const NO_COLOR_CODE = '$';
    const NO_COLOR_NAME = 'SIN COLOR';
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [error, setError] = useState('');
    const [quickCurveOpen, setQuickCurveOpen] = useState(false);
    const [supplierColors, setSupplierColors] = useState<SupplierColorRecord[]>([]);
    const [loadingSupplierColors, setLoadingSupplierColors] = useState(false);
    const [creatingSupplierColor, setCreatingSupplierColor] = useState(false);
    const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(null);
    const [editingVariantQuantities, setEditingVariantQuantities] = useState<Record<string, number>>({});

    const activeCurveOption = useMemo(
        () => sizeCurveOptions.find((option) => option.id === itemContext.sizeCurveId) ?? null,
        [itemContext.sizeCurveId, sizeCurveOptions]
    );
    const subtotal = useMemo(
        () => itemContext.curvaTalles.reduce((acc, size) => acc + Number(quantities[size] ?? 0), 0),
        [itemContext.curvaTalles, quantities]
    );

    useEffect(() => {
        let mounted = true;
        const loadSupplierColors = async () => {
            if (!itemContext.supplierId) return;
            setLoadingSupplierColors(true);
            try {
                const colors = await api.getSupplierColors(itemContext.supplierId);
                if (!mounted) return;
                setSupplierColors(colors);
            } catch {
                if (!mounted) return;
                setSupplierColors([]);
            } finally {
                if (mounted) setLoadingSupplierColors(false);
            }
        };

        void loadSupplierColors();
        return () => {
            mounted = false;
        };
    }, [itemContext.supplierId]);

    const handleQtyChange = (size: string, val: string) => {
        const num = parseInt(val, 10) || 0;
        setQuantities((prev) => ({ ...prev, [size]: num }));
    };

    const handleQuickCurveApply = (values: Record<string, number>) => {
        const normalized = Object.fromEntries(
            itemContext.curvaTalles.map((sizeKey) => [sizeKey, Number(values[sizeKey] ?? 0)])
        );
        setQuantities((prev) => ({ ...prev, ...normalized }));
    };

    const handleAddColor = () => {
        if (!code || !name) {
            setError('El código y el nombre del color son obligatorios.');
            return;
        }

        const hasQuantity = Object.values(quantities).some((q) => q > 0);
        if (!hasQuantity) {
            setError('Al menos un talle debe tener una cantidad mayor a 0.');
            return;
        }

        if (addedColors.some((c) => c.codigoColor === code)) {
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

    const handleCreateSupplierColor = async () => {
        if (!itemContext.supplierId) {
            setError('No hay proveedor seleccionado para guardar el color.');
            return;
        }
        if (!code.trim() || !name.trim()) {
            setError('Código y nombre de color son obligatorios para guardarlo en catálogo.');
            return;
        }

        setCreatingSupplierColor(true);
        setError('');
        try {
            const created = await api.createSupplierColor(itemContext.supplierId, {
                code: code.trim().toUpperCase(),
                value: name.trim()
            });
            setSupplierColors((prev) => {
                const filtered = prev.filter((entry) => entry.id !== created.id && entry.code !== created.code);
                return [...filtered, created].sort((a, b) => a.code.localeCompare(b.code));
            });
            setCode(created.code);
            setName(created.value);
        } catch (err) {
            const message = err instanceof ApiError ? err.message : 'No pudimos guardar el color en el proveedor.';
            setError(message);
        } finally {
            setCreatingSupplierColor(false);
        }
    };

    const openEditVariantModal = (index: number) => {
        const variant = addedColors[index];
        if (!variant) return;
        const normalized = Object.fromEntries(
            itemContext.curvaTalles.map((size) => [size, Number(variant.cantidadesPorTalle[size] ?? 0)])
        );
        setEditingVariantIndex(index);
        setEditingVariantQuantities(normalized);
    };

    const closeEditVariantModal = () => {
        setEditingVariantIndex(null);
        setEditingVariantQuantities({});
    };

    const handleEditVariantQuantityChange = (size: string, value: string) => {
        const parsed = Number.parseInt(value, 10);
        const sanitized = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
        setEditingVariantQuantities((prev) => ({ ...prev, [size]: sanitized }));
    };

    const handleSaveVariantEdition = () => {
        if (editingVariantIndex === null || !addedColors[editingVariantIndex]) return;

        const updatedVariant: VarianteColor = {
            ...addedColors[editingVariantIndex],
            cantidadesPorTalle: Object.fromEntries(
                itemContext.curvaTalles.map((size) => [size, Number(editingVariantQuantities[size] ?? 0)])
            )
        };

        onUpdateColor(editingVariantIndex, updatedVariant);
        closeEditVariantModal();
    };

    const buildNoColorVariant = (): VarianteColor | null => {
        const normalizedQuantities = Object.fromEntries(
            itemContext.curvaTalles.map((sizeKey) => [sizeKey, Number(quantities[sizeKey] ?? 0)])
        );

        const hasQuantity = Object.values(normalizedQuantities).some((qty) => qty > 0);
        if (!hasQuantity) {
            return null;
        }

        return {
            codigoColor: NO_COLOR_CODE,
            nombreColor: NO_COLOR_NAME,
            cantidadesPorTalle: normalizedQuantities
        };
    };

    const handleFinish = () => {
        if (readOnly) return;

        if (addedColors.length > 0) {
            onFinishItem(addedColors);
            return;
        }

        const noColorVariant = buildNoColorVariant();
        if (!noColorVariant) {
            setError('Cargá al menos una cantidad por talle o agregá una variante de color antes de guardar.');
            return;
        }

        onFinishItem([noColorVariant]);
    };

    return (
        <div className="flex flex-col gap-4 sm:gap-6 max-w-4xl mx-auto">
            <Card className="bg-slate-800 border-slate-700">
                <div className="flex flex-col gap-2">
                    <h2 className="text-lg font-bold text-white">{itemContext.codigoArticulo} - {itemContext.descripcionArticulo}</h2>
                    {activeCurveOption && (
                        <p className="text-slate-400 text-sm">{activeCurveOption.code} · {activeCurveOption.values.join(', ')}</p>
                    )}
                </div>
            </Card>

            <Card title="Agrega el color (opcional)">
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <Input
                            label="Código de color"
                            value={code}
                            onChange={(e) => {
                                const nextCode = e.target.value;
                                setCode(nextCode);
                                const matchingColor = supplierColors.find((entry) => entry.code.toLowerCase() === nextCode.trim().toLowerCase());
                                if (matchingColor) {
                                    setName(matchingColor.value);
                                }
                            }}
                            placeholder="Ej: 001"
                            disabled={readOnly}
                            list="supplier-colors-codes"
                        />
                        <Input
                            label="Nombre de color"
                            value={name}
                            onChange={(e) => {
                                const nextName = e.target.value;
                                setName(nextName);
                                const matchingColor = supplierColors.find((entry) => entry.value.toLowerCase() === nextName.trim().toLowerCase());
                                if (matchingColor && !code.trim()) {
                                    setCode(matchingColor.code);
                                }
                            }}
                            placeholder="Ej: Negro"
                            disabled={readOnly}
                            list="supplier-colors-values"
                        />
                    </div>

                    <datalist id="supplier-colors-codes">
                        {supplierColors.map((color) => (
                            <option key={`${color.id}-code`} value={color.code}>{color.value}</option>
                        ))}
                    </datalist>
                    <datalist id="supplier-colors-values">
                        {supplierColors.map((color) => (
                            <option key={`${color.id}-value`} value={color.value}>{color.code}</option>
                        ))}
                    </datalist>

                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button variant="secondary" onClick={() => setQuickCurveOpen(true)} disabled={readOnly}>
                            Curva rápida
                        </Button>
                        <Button variant="ghost" onClick={() => void handleCreateSupplierColor()} disabled={readOnly || creatingSupplierColor || !code.trim() || !name.trim()}>
                            {creatingSupplierColor ? 'Guardando color...' : 'Guardar color en proveedor'}
                        </Button>
                    </div>
                    <p className="text-xs text-slate-500">
                        {loadingSupplierColors
                            ? 'Cargando colores del proveedor...'
                            : supplierColors.length > 0
                                ? `Colores disponibles: ${supplierColors.length}`
                                : 'No hay colores guardados para este proveedor todavía.'}
                    </p>

                    <div className="mt-1">
                        <label className="text-sm font-medium text-slate-400 mb-2 block">Cantidades por talle</label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {itemContext.curvaTalles.map((size) => (
                                <div key={size} className="flex flex-col">
                                    <span className="text-xs text-center text-slate-500 mb-1">{size}</span>
                                    <Input
                                        type="number"
                                        min="0"
                                        className="text-center"
                                        value={quantities[size] ?? ''}
                                        onChange={(e) => handleQtyChange(size, e.target.value)}
                                        disabled={readOnly}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {error && <p className="text-red-500 text-sm">{error}</p>}

                    <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-slate-200">
                        Subtotal de curva: <strong>{subtotal}</strong>
                    </div>

                    <Button onClick={handleAddColor} variant="secondary" className="mt-2 w-full sm:w-auto" disabled={readOnly}>
                        Agregar variante
                    </Button>
                </div>
            </Card>

            <Card title={`Variantes agregadas (${addedColors.length})`}>
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                    {addedColors.length === 0 && (
                        <p className="text-slate-500 text-center py-8">Este ítem no tiene variantes de color cargadas.</p>
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
                                className="text-slate-200 hover:text-white"
                                onClick={() => openEditVariantModal(idx)}
                                disabled={readOnly}
                                icon={<PencilLine className="h-4 w-4" />}
                            >
                                Editar
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-400 hover:text-red-300"
                                onClick={() => onRemoveColor(idx)}
                                disabled={readOnly}
                            >
                                Quitar
                            </Button>
                        </div>
                    ))}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-700 flex flex-col sm:flex-row gap-2 sm:justify-between">
                    <Button variant="ghost" onClick={onBack} className="w-full sm:w-auto" icon={<ArrowLeft className="h-4 w-4" />}>Volver a factura</Button>
                    <Button
                        onClick={handleFinish}
                        disabled={readOnly}
                        variant="primary"
                        icon={<Check className="h-4 w-4" />}
                        className="w-full sm:w-auto"
                    >
                        {addedColors.length === 0 ? 'Guardar ítem sin color' : 'Guardar ítem'}
                    </Button>
                </div>
            </Card>

            <QuickCurvesModal
                isOpen={quickCurveOpen}
                onClose={() => setQuickCurveOpen(false)}
                mode="apply"
                initialSizeCurveId={itemContext.sizeCurveId}
                sizeCurveOptions={sizeCurveOptions}
                onApply={handleQuickCurveApply}
            />

            {editingVariantIndex !== null && addedColors[editingVariantIndex] && (
                <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center" role="presentation" onClick={closeEditVariantModal}>
                    <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-white">
                                Editar {addedColors[editingVariantIndex].nombreColor} ({addedColors[editingVariantIndex].codigoColor})
                            </h3>
                            <button type="button" className="rounded-md p-1 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={closeEditVariantModal}>
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {itemContext.curvaTalles.map((size) => (
                                <div key={`edit-${size}`} className="flex flex-col">
                                    <span className="mb-1 text-center text-xs text-slate-400">{size}</span>
                                    <Input
                                        type="number"
                                        min="0"
                                        className="text-center"
                                        value={editingVariantQuantities[size] ?? 0}
                                        onChange={(event) => handleEditVariantQuantityChange(size, event.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <Button type="button" variant="ghost" onClick={closeEditVariantModal}>Cancelar</Button>
                            <Button type="button" variant="primary" onClick={handleSaveVariantEdition}>Guardar cambios</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
