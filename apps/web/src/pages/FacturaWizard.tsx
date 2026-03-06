import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFactura } from '../context/FacturaContext';
import { ArticleStep } from '../features/wizard/ArticleStep';
import { ColorStep } from '../features/wizard/ColorStep';
import { FacturaItem, VarianteColor, FacturaEstado } from '@stockia/shared';
import { AlertTriangle, Loader2, Lock } from 'lucide-react';
import { useAutosave } from '../hooks/useAutosave';
import { ApiError, api } from '../services/api';
import styles from './FacturaWizard.module.css';

const getEstadoLabel = (estado: string) => (estado === 'FINAL' ? 'Final' : 'Borrador');

type WizardStep = 'ARTICLE' | 'COLOR';

type SupplierOption = { value: string; label: string; id: string };
type GarmentTypeOption = { value: string; label: string; id: string };
type SizeCurveOption = { value: string; label: string; id: string; values: string[] };

export function FacturaWizard() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { state, loadFactura, updateDraft } = useFactura();

    const [step, setStep] = useState<WizardStep>('ARTICLE');
    const { conflictState, actions: autosaveActions } = useAutosave();

    const [draftItem, setDraftItem] = useState({ supplierLabel: '', tipoPrenda: '', codigoArticulo: '', curvaTalles: '' });
    const [draftColors, setDraftColors] = useState<VarianteColor[]>([]);
    const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
    const [garmentTypeOptions, setGarmentTypeOptions] = useState<GarmentTypeOption[]>([]);
    const [sizeCurveOptions, setSizeCurveOptions] = useState<SizeCurveOption[]>([]);
    const [catalogsLoading, setCatalogsLoading] = useState(false);
    const [catalogsError, setCatalogsError] = useState<string | null>(null);

    const currentFacturaId = state.currentFactura?.id;

    useEffect(() => {
        if (id && currentFacturaId !== id) {
            loadFactura(id);
        }
    }, [id, currentFacturaId, loadFactura]);

    useEffect(() => {
        const loadCatalogOptions = async () => {
            setCatalogsLoading(true);
            setCatalogsError(null);
            try {
                const operationsCatalogs = await api.getOperationsCatalogs();
                setSupplierOptions(operationsCatalogs.suppliers.map((entry) => ({ id: entry.id, value: entry.label, label: entry.label })));
                setGarmentTypeOptions(operationsCatalogs.families.map((entry) => ({ id: entry.id, value: entry.label, label: entry.label })));
                setSizeCurveOptions(operationsCatalogs.curves.map((entry) => {
                    const match = entry.label.match(/\((.*?)\)\s*$/);
                    const values = match?.[1] ? match[1].split(',').map((size) => size.trim()).filter(Boolean) : entry.label.split(',').map((size) => size.trim()).filter(Boolean);
                    return { id: entry.id, value: values.join(','), values, label: entry.label };
                }));
            } catch (error) {
                const message = error instanceof ApiError ? error.message : 'No pudimos cargar los catálogos para completar el artículo.';
                setCatalogsError(message);
            } finally {
                setCatalogsLoading(false);
            }
        };

        void loadCatalogOptions();
    }, []);

    const isFinal = state.currentFactura?.estado === FacturaEstado.FINAL;

    const handleArticleChange = (field: string, value: string) => {
        if (isFinal) return;
        setDraftItem((prev) => ({ ...prev, [field]: value }));
    };

    const handleFinishItem = () => {
        if (isFinal || !state.currentFactura) return;

        const selectedGarmentType = garmentTypeOptions.find((option) => option.value === draftItem.tipoPrenda);
        const selectedCurve = sizeCurveOptions.find((option) => option.value === draftItem.curvaTalles);
        const curva = selectedCurve?.values?.length ? selectedCurve.values : draftItem.curvaTalles.split(',').map((s) => s.trim()).filter(Boolean);

        const newItem: FacturaItem = {
            supplierLabel: draftItem.supplierLabel,
            marca: draftItem.supplierLabel,
            tipoPrenda: draftItem.tipoPrenda,
            codigoArticulo: draftItem.codigoArticulo,
            sizeCurveId: selectedCurve?.id,
            curvaTalles: curva,
            garmentTypeSnapshot: selectedGarmentType ? { id: selectedGarmentType.id, code: selectedGarmentType.id, label: selectedGarmentType.label } : undefined,
            sizeCurveSnapshot: selectedCurve ? { id: selectedCurve.id, code: selectedCurve.id, label: selectedCurve.label, values: curva } : undefined,
            colores: draftColors
        };

        const updatedItems = [...(state.currentFactura.items || []), newItem];
        updateDraft({ items: updatedItems });
        setDraftColors([]);
        setStep('ARTICLE');
        setDraftItem({ supplierLabel: '', tipoPrenda: '', codigoArticulo: '', curvaTalles: '' });
    };

    if (state.isLoading || !state.currentFactura) {
        return <div className={styles.loader}><Loader2 className={styles.spinner} /></div>;
    }

    return (
        <div className={styles.page}>
            <header className={styles.hero}>
                <h1>Factura: {state.currentFactura.nroFactura}</h1>
                <p>{state.currentFactura.proveedor || 'Sin proveedor'} · Ítems: {state.currentFactura.items?.length || 0}</p>
                <div className={styles.heroRow}>
                    <span className={isFinal ? styles.statusFinal : styles.statusDraft}>{getEstadoLabel(state.currentFactura.estado)}</span>
                    <button onClick={() => navigate(`/facturas/${id}/summary`)} className={styles.summaryButton}>Ver resumen</button>
                </div>
            </header>

            {isFinal && (
                <div className={styles.noticeSuccess}><Lock size={16} /> La factura está finalizada y es de solo lectura.</div>
            )}

            {conflictState.hasConflict && !isFinal && (
                <div className={styles.noticeWarning}>
                    <AlertTriangle size={16} />
                    <div>
                        <p>{conflictState.message || 'Otro usuario o pestaña actualizó esta factura.'}</p>
                        <div className={styles.noticeActions}>
                            <button onClick={autosaveActions.reloadFromServer}>Recargar</button>
                            <button onClick={autosaveActions.keepLocalChanges}>Conservar local</button>
                            <button onClick={autosaveActions.retrySave}>Reintentar</button>
                        </div>
                    </div>
                </div>
            )}

            {step === 'ARTICLE' && (
                <ArticleStep
                    draftItem={draftItem}
                    supplierOptions={supplierOptions}
                    garmentTypeOptions={garmentTypeOptions}
                    sizeCurveOptions={sizeCurveOptions}
                    catalogsLoading={catalogsLoading}
                    catalogsError={catalogsError}
                    onChange={handleArticleChange}
                    onNext={() => !isFinal && setStep('COLOR')}
                    readOnly={isFinal}
                />
            )}

            {step === 'COLOR' && (
                <ColorStep
                    itemContext={{ ...draftItem, curvaTalles: draftItem.curvaTalles.split(',').map((s) => s.trim()) }}
                    addedColors={draftColors}
                    onAddColor={(color) => !isFinal && setDraftColors((prev) => [...prev, color])}
                    onRemoveColor={(index) => !isFinal && setDraftColors((prev) => prev.filter((_, i) => i !== index))}
                    onFinishItem={handleFinishItem}
                    onBack={() => setStep('ARTICLE')}
                    readOnly={isFinal}
                />
            )}
        </div>
    );
}
