import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFactura } from '../context/FacturaContext';
import { ArticleStep } from '../features/wizard/ArticleStep';
import { ColorStep } from '../features/wizard/ColorStep';
import { FacturaItem, VarianteColor } from '@stockia/shared';
import { Loader2 } from 'lucide-react';

type WizardStep = 'ARTICLE' | 'COLOR';

export function FacturaWizard() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { state, loadFactura, updateDraft } = useFactura();

    const [step, setStep] = useState<WizardStep>('ARTICLE');

    // Draft Item State
    const [draftItem, setDraftItem] = useState({
        marca: '',
        tipoPrenda: '',
        codigoArticulo: '',
        curvaTalles: ''
    });

    const [draftColors, setDraftColors] = useState<VarianteColor[]>([]);

    useEffect(() => {
        if (id && (!state.currentFactura || state.currentFactura.id !== id)) {
            loadFactura(id);
        }
    }, [id, state.currentFactura, loadFactura]);

    const handleArticleChange = (field: string, value: string) => {
        setDraftItem(prev => ({ ...prev, [field]: value }));
    };

    const handleNextToColor = () => {
        // Basic validation handled in ArticleStep, strict validation here if needed
        setStep('COLOR');
    };

    const handleAddColor = (color: VarianteColor) => {
        setDraftColors(prev => [...prev, color]);
    };

    const handleRemoveColor = (index: number) => {
        setDraftColors(prev => prev.filter((_, i) => i !== index));
    };

    const handleFinishItem = () => {
        if (!state.currentFactura) return;

        // Parse Curve
        const curva = draftItem.curvaTalles.split(',').map(s => s.trim()).filter(Boolean);

        // Construct New Item
        const newItem: FacturaItem = {
            marca: draftItem.marca,
            tipoPrenda: draftItem.tipoPrenda,
            codigoArticulo: draftItem.codigoArticulo,
            curvaTalles: curva,
            colores: draftColors
        };

        // Update Context (Autosave triggers)
        const updatedItems = [...(state.currentFactura.items || []), newItem];
        updateDraft({ items: updatedItems });

        // Reset Wizard
        setDraftColors([]);
        // We stay on Article Step to add next item
        setStep('ARTICLE');
        // We might want to keep Brand/Curve? For now clear all.
        setDraftItem({
            marca: '',
            tipoPrenda: '',
            codigoArticulo: '',
            curvaTalles: ''
        });
    };

    if (state.status === 'LOADING' || !state.currentFactura) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center bg-slate-800 p-4 rounded-lg">
                <div>
                    <h1 className="text-xl font-bold text-white">Invoice: {state.currentFactura.nroFactura}</h1>
                    <p className="text-sm text-slate-400">
                        {state.currentFactura.proveedor || 'No Provider'} •
                        Items: {state.currentFactura.items?.length || 0}
                    </p>
                </div>
                <div className="flex gap-2">
                    <span className="text-xs text-slate-500 px-2 py-1 bg-slate-900 rounded border border-slate-700">
                        {state.status === 'SAVING' ? 'Saving...' : state.status === 'ERROR' ? 'Error Saving' : 'Saved'}
                    </span>
                    <button
                        onClick={() => navigate(`/facturas/${id}/summary`)}
                        className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                    >
                        View Summary
                    </button>
                </div>
            </div>

            {step === 'ARTICLE' && (
                <ArticleStep
                    draftItem={draftItem}
                    onChange={handleArticleChange}
                    onNext={handleNextToColor}
                />
            )}

            {step === 'COLOR' && (
                <ColorStep
                    itemContext={{ ...draftItem, curvaTalles: draftItem.curvaTalles.split(',').map(s => s.trim()) }}
                    addedColors={draftColors}
                    onAddColor={handleAddColor}
                    onRemoveColor={handleRemoveColor}
                    onFinishItem={handleFinishItem}
                    onBack={() => setStep('ARTICLE')}
                />
            )}
        </div>
    );
}
