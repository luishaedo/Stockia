import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFactura } from '../context/FacturaContext';
import { ArticleStep } from '../features/wizard/ArticleStep';
import { ColorStep } from '../features/wizard/ColorStep';
import { FacturaItem, VarianteColor, FacturaEstado } from '@stockia/shared';
import { Loader2, Lock } from 'lucide-react';
import { useAutosave } from '../hooks/useAutosave';

type WizardStep = 'ARTICLE' | 'COLOR';

export function FacturaWizard() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { state, loadFactura, updateDraft } = useFactura();

    const [step, setStep] = useState<WizardStep>('ARTICLE');

    useAutosave();

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

    const isFinal = state.currentFactura?.estado === FacturaEstado.FINAL;

    const handleArticleChange = (field: string, value: string) => {
        if (isFinal) return; // Block edits on FINAL
        setDraftItem(prev => ({ ...prev, [field]: value }));
    };

    const handleNextToColor = () => {
        if (isFinal) return;
        setStep('COLOR');
    };

    const handleAddColor = (color: VarianteColor) => {
        if (isFinal) return;
        setDraftColors(prev => [...prev, color]);
    };

    const handleRemoveColor = (index: number) => {
        if (isFinal) return;
        setDraftColors(prev => prev.filter((_, i) => i !== index));
    };

    const handleFinishItem = () => {
        if (isFinal || !state.currentFactura) return;

        const curva = draftItem.curvaTalles.split(',').map(s => s.trim()).filter(Boolean);

        const newItem: FacturaItem = {
            marca: draftItem.marca,
            tipoPrenda: draftItem.tipoPrenda,
            codigoArticulo: draftItem.codigoArticulo,
            curvaTalles: curva,
            colores: draftColors
        };

        const updatedItems = [...(state.currentFactura.items || []), newItem];
        updateDraft({ items: updatedItems });

        setDraftColors([]);
        setStep('ARTICLE');
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
            {isFinal && (
                <div className="bg-green-500/10 border border-green-500/50 rounded p-4 flex items-center gap-3">
                    <Lock className="h-5 w-5 text-green-400" />
                    <div>
                        <span className="text-green-400 font-medium">Invoice is finalized and read-only</span>
                        <p className="text-sm text-slate-400 mt-1">All editing controls are disabled. Navigate to Summary to view details.</p>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center bg-slate-800 p-4 rounded-lg">
                <div>
                    <h1 className="text-xl font-bold text-white">Invoice: {state.currentFactura.nroFactura}</h1>
                    <p className="text-sm text-slate-400">
                        {state.currentFactura.proveedor || 'No Provider'} •
                        Items: {state.currentFactura.items?.length || 0} •
                        Status: <span className={isFinal ? 'text-green-400' : 'text-yellow-400'}>{state.currentFactura.estado}</span>
                    </p>
                </div>
                <div className="flex gap-2">
                    {!isFinal && (
                        <span className="text-xs text-slate-500 px-2 py-1 bg-slate-900 rounded border border-slate-700">
                            {state.status === 'SAVING' ? 'Saving...' : state.status === 'ERROR' ? 'Error Saving' : 'Saved'}
                        </span>
                    )}
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
                    readOnly={isFinal}
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
                    readOnly={isFinal}
                />
            )}
        </div>
    );
}
