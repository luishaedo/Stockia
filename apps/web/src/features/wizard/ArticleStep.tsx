import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ArrowRight } from 'lucide-react';

interface ArticleStepProps {
    draftItem: {
        marca: string;
        tipoPrenda: string;
        codigoArticulo: string;
        curvaTalles: string; // Store as comma-sep string for input, parse later
    };
    onChange: (field: string, value: string) => void;
    onNext: () => void;
}

export function ArticleStep({ draftItem, onChange, onNext }: ArticleStepProps) {
    const isValid = draftItem.marca && draftItem.tipoPrenda && draftItem.codigoArticulo && draftItem.curvaTalles;

    return (
        <Card title="Step 1: Article Details" className="max-w-xl mx-auto">
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Brand"
                        value={draftItem.marca}
                        onChange={(e) => onChange('marca', e.target.value)}
                        placeholder="e.g. Nike"
                    />
                    <Input
                        label="Type"
                        value={draftItem.tipoPrenda}
                        onChange={(e) => onChange('tipoPrenda', e.target.value)}
                        placeholder="e.g. T-Shirt"
                    />
                </div>

                <Input
                    label="Article Code"
                    value={draftItem.codigoArticulo}
                    onChange={(e) => onChange('codigoArticulo', e.target.value)}
                    placeholder="e.g. NK-1002"
                />

                <Input
                    label="Size Curve (comma separated)"
                    value={draftItem.curvaTalles}
                    onChange={(e) => onChange('curvaTalles', e.target.value)}
                    placeholder="e.g. S, M, L, XL"
                />
                <p className="text-xs text-gray-500">Enter sizes separated by commas.</p>

                <div className="mt-4 flex justify-end">
                    <Button
                        onClick={onNext}
                        disabled={!isValid}
                        icon={<ArrowRight className="h-4 w-4" />}
                    >
                        Next: Add Colors
                    </Button>
                </div>
            </div>
        </Card>
    );
}
