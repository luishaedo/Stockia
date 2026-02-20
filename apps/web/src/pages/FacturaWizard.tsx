import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFactura } from '../context/FacturaContext';
import { ArticleStep } from '../features/wizard/ArticleStep';
import { ColorStep } from '../features/wizard/ColorStep';
import { FacturaItem, VarianteColor, FacturaEstado } from '@stockia/shared';
import { AlertTriangle, Loader2, Lock } from 'lucide-react';
import { useAutosave } from '../hooks/useAutosave';

const getEstadoLabel = (estado: string) => (estado === 'FINAL' ? 'Final' : 'Borrador');

type WizardStep = 'ARTICLE' | 'COLOR';

export function FacturaWizard() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { state, loadFactura, updateDraft } = useFactura();

    const [step, setStep] = useState<WizardStep>('ARTICLE');
    const { conflictState, actions: autosaveActions } = useAutosave();

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
        if (isFinal) return;
        setDraftItem(prev => ({ ...prev, [field]: value }));
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
        setDraftItem({ marca: '', tipoPrenda: '', codigoArticulo: '', curvaTalles: '' });
    };

    if (state.status === 'LOADING' || !state.currentFactura) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            {isFinal && (
                <div className="bg-green-500/10 border border-green-500/50 rounded p-4 flex items-center gap-3">
                    <Lock className="h-5 w-5 text-green-400" />
                    <div>
                        <span className="text-green-400 font-medium">La factura está finalizada y es de solo lectura.</span>
                        <p className="text-sm text-slate-400 mt-1">Todos los controles de edición están deshabilitados. Podés ir al resumen para ver el detalle.</p>
                    </div>
                </div>
            )}

            {conflictState.hasConflict && !isFinal && (
                <div className="bg-amber-500/10 border border-amber-500/50 rounded p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5" />
                        <div className="flex-1">
                            <span className="text-amber-300 font-medium">Se detectó un conflicto de autoguardado</span>
                            <p className="text-sm text-slate-300 mt-1">
                                {conflictState.message || 'Otro usuario o pestaña actualizó esta factura.'}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-3">
                                <button
                                    onClick={autosaveActions.reloadFromServer}
                                    className="text-xs px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700"
                                >
                                    Recargar última versión
                                </button>
                                <button
                                    onClick={autosaveActions.keepLocalChanges}
                                    className="text-xs px-3 py-2 rounded bg-amber-500 text-slate-900 font-medium hover:bg-amber-400"
                                >
                                    Conservar cambios locales
                                </button>
                                <button
                                    onClick={autosaveActions.retrySave}
                                    className="text-xs px-3 py-2 rounded bg-slate-900 border border-amber-500/60 text-amber-300 hover:bg-slate-800"
                                >
                                    Reintentar guardado
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-slate-800 p-4 rounded-lg">
                <div>
                    <h1 className="text-lg sm:text-xl font-bold text-white">Factura: {state.currentFactura.nroFactura}</h1>
                    <p className="text-sm text-slate-400">
                        {state.currentFactura.proveedor || 'Sin proveedor'} • Ítems: {state.currentFactura.items?.length || 0} • Estado: <span className={isFinal ? 'text-green-400' : 'text-yellow-400'}>{getEstadoLabel(state.currentFactura.estado)}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {!isFinal && (
                        <span className="text-xs text-slate-500 px-2 py-1 bg-slate-900 rounded border border-slate-700">
                            {conflictState.hasConflict
                                ? 'Conflicto'
                                : state.status === 'SAVING'
                                    ? 'Guardando...'
                                    : state.status === 'ERROR'
                                        ? 'Error al guardar'
                                        : 'Guardado'}
                        </span>
                    )}
                    <button
                        onClick={() => navigate(`/facturas/${id}/summary`)}
                        className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                    >
                        Ver resumen
                    </button>
                </div>
            </div>

            {step === 'ARTICLE' && (
                <ArticleStep
                    draftItem={draftItem}
                    onChange={handleArticleChange}
                    onNext={() => !isFinal && setStep('COLOR')}
                    readOnly={isFinal}
                />
            )}

            {step === 'COLOR' && (
                <ColorStep
                    itemContext={{ ...draftItem, curvaTalles: draftItem.curvaTalles.split(',').map(s => s.trim()) }}
                    addedColors={draftColors}
                    onAddColor={(color) => !isFinal && setDraftColors(prev => [...prev, color])}
                    onRemoveColor={(index) => !isFinal && setDraftColors(prev => prev.filter((_, i) => i !== index))}
                    onFinishItem={handleFinishItem}
                    onBack={() => setStep('ARTICLE')}
                    readOnly={isFinal}
                />
            )}
        </div>
    );
}
