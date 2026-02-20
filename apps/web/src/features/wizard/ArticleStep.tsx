import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ArrowRight } from 'lucide-react';

interface ArticleStepProps {
    draftItem: {
        marca: string;
        tipoPrenda: string;
        codigoArticulo: string;
        curvaTalles: string;
    };
    onChange: (field: string, value: string) => void;
    onNext: () => void;
    readOnly?: boolean;
}

export function ArticleStep({ draftItem, onChange, onNext, readOnly = false }: ArticleStepProps) {
    const isValid = draftItem.marca && draftItem.tipoPrenda && draftItem.codigoArticulo && draftItem.curvaTalles;

    return (
        <Card title="Paso 1/2 · Datos del artículo" className="max-w-xl mx-auto">
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                        label="Marca"
                        value={draftItem.marca}
                        onChange={(e) => onChange('marca', e.target.value)}
                        placeholder="Ej: Nike"
                        disabled={readOnly}
                    />
                    <Input
                        label="Tipo de prenda"
                        value={draftItem.tipoPrenda}
                        onChange={(e) => onChange('tipoPrenda', e.target.value)}
                        placeholder="Ej: Remera"
                        disabled={readOnly}
                    />
                </div>

                <Input
                    label="Código de artículo"
                    value={draftItem.codigoArticulo}
                    onChange={(e) => onChange('codigoArticulo', e.target.value)}
                    placeholder="Ej: NK-1002"
                    disabled={readOnly}
                />

                <Input
                    label="Curva de talles (separada por comas)"
                    value={draftItem.curvaTalles}
                    onChange={(e) => onChange('curvaTalles', e.target.value)}
                    placeholder="Ej: S, M, L, XL"
                    disabled={readOnly}
                />
                <p className="text-xs text-gray-400">Ingresá los talles separados por coma.</p>

                <div className="mt-2">
                    <Button
                        onClick={onNext}
                        disabled={!isValid || readOnly}
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
