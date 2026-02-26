import { Link } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ArrowRight, AlertCircle } from 'lucide-react';

type Option = { value: string; label: string };

interface ArticleStepProps {
    draftItem: {
        supplierLabel: string;
        tipoPrenda: string;
        codigoArticulo: string;
        curvaTalles: string;
    };
    supplierOptions: Option[];
    garmentTypeOptions: Option[];
    sizeCurveOptions: Option[];
    catalogsLoading: boolean;
    catalogsError: string | null;
    onChange: (field: string, value: string) => void;
    onNext: () => void;
    readOnly?: boolean;
}

export function ArticleStep({
    draftItem,
    supplierOptions,
    garmentTypeOptions,
    sizeCurveOptions,
    catalogsLoading,
    catalogsError,
    onChange,
    onNext,
    readOnly = false
}: ArticleStepProps) {
    const hasMissingCatalogs = supplierOptions.length === 0 || garmentTypeOptions.length === 0 || sizeCurveOptions.length === 0;
    const catalogBlockReason = catalogsError
        || (hasMissingCatalogs ? 'Faltan catálogos obligatorios. Primero debés crear Proveedores, Tipos de prenda y Curvas de talle desde Admin.' : null);

    const isValid = draftItem.supplierLabel && draftItem.tipoPrenda && draftItem.codigoArticulo && draftItem.curvaTalles && !catalogBlockReason;

    return (
        <Card title="Paso 1/2 · Datos del artículo" className="max-w-xl mx-auto">
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Proveedor</label>
                        <select
                            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 disabled:opacity-60"
                            value={draftItem.supplierLabel}
                            onChange={(e) => onChange('supplierLabel', e.target.value)}
                            disabled={readOnly || catalogsLoading || supplierOptions.length === 0}
                        >
                            <option value="">Seleccionar proveedor</option>
                            {supplierOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Tipo de prenda</label>
                        <select
                            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 disabled:opacity-60"
                            value={draftItem.tipoPrenda}
                            onChange={(e) => onChange('tipoPrenda', e.target.value)}
                            disabled={readOnly || catalogsLoading || garmentTypeOptions.length === 0}
                        >
                            <option value="">Seleccionar tipo</option>
                            {garmentTypeOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <Input
                    label="Código de artículo"
                    value={draftItem.codigoArticulo}
                    onChange={(e) => onChange('codigoArticulo', e.target.value)}
                    placeholder="Ej: NK-1002"
                    disabled={readOnly}
                />

                <div>
                    <label className="block text-sm font-medium mb-1">Curva de talles</label>
                    <select
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 disabled:opacity-60"
                        value={draftItem.curvaTalles}
                        onChange={(e) => onChange('curvaTalles', e.target.value)}
                        disabled={readOnly || catalogsLoading || sizeCurveOptions.length === 0}
                    >
                        <option value="">Seleccionar curva</option>
                        {sizeCurveOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>

                {catalogBlockReason && (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 mt-0.5" />
                            <div>
                                <p>{catalogBlockReason}</p>
                                <Link to="/admin" className="underline text-amber-200 hover:text-amber-100">Ir a Administración de catálogos</Link>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-2">
                    <Button
                        onClick={onNext}
                        disabled={!isValid || readOnly || catalogsLoading}
                        icon={<ArrowRight className="h-4 w-4" />}
                        className="w-full sm:w-auto"
                    >
                        Continuar: agregar colores
                    </Button>
                </div>
            </div>
        </Card>
    );
}
