import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFactura } from '../context/FacturaContext';
import { ArticleStep, ArticleDraftForm } from '../features/wizard/ArticleStep';
import { ColorStep } from '../features/wizard/ColorStep';
import { FacturaItem, VarianteColor, FacturaEstado } from '@stockia/shared';
import { AlertTriangle, Loader2, Lock, ArrowLeft } from 'lucide-react';
import { useAutosave } from '../hooks/useAutosave';
import { ArticleResponse } from '../services/articlesApi';
import { ApiError, api } from '../services/api';
import styles from './FacturaWizard.module.css';

const getEstadoLabel = (estado: string) => (estado === 'FINAL' ? 'Final' : 'Borrador');

type WizardStep = 'ARTICLE' | 'COLOR';

type CatalogOption = { value: string; label: string; id: string; code: string };
type SizeCurveOption = { value: string; label: string; id: string; values: string[]; code: string };
type AdminCatalogItem = { id: string; code: string; description?: string; name?: string };
type SizeCurveCatalogItem = { id: string; code: string; description: string; values?: Array<{ value: string }> };

const INITIAL_ARTICLE_DRAFT: ArticleDraftForm = {
    sku: '',
    description: '',
    familyId: '',
    categoryId: '',
    garmentTypeId: '',
    classificationId: '',
    materialId: '',
    sizeCurveId: ''
};

const mapArticleToDraft = (article: ArticleResponse): ArticleDraftForm => ({
    sku: article.sku,
    description: article.description,
    familyId: article.familyId,
    categoryId: article.categoryId,
    garmentTypeId: article.garmentTypeId,
    classificationId: article.classificationId,
    materialId: article.materialId,
    sizeCurveId: article.sizeCurveId
});

export function FacturaWizard() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { state, loadFactura, updateDraft } = useFactura();

    const [step, setStep] = useState<WizardStep>('ARTICLE');
    const { conflictState, actions: autosaveActions } = useAutosave();

    const [articleDraft, setArticleDraft] = useState<ArticleDraftForm>(INITIAL_ARTICLE_DRAFT);
    const [selectedArticle, setSelectedArticle] = useState<ArticleResponse | null>(null);
    const [draftColors, setDraftColors] = useState<VarianteColor[]>([]);
    const [familyOptions, setFamilyOptions] = useState<CatalogOption[]>([]);
    const [categoryOptions, setCategoryOptions] = useState<CatalogOption[]>([]);
    const [garmentTypeOptions, setGarmentTypeOptions] = useState<CatalogOption[]>([]);
    const [classificationOptions, setClassificationOptions] = useState<CatalogOption[]>([]);
    const [materialOptions, setMaterialOptions] = useState<CatalogOption[]>([]);
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
        const mapCatalogItems = (items: AdminCatalogItem[]) => (
            items.map((entry) => ({
                id: entry.id,
                value: entry.id,
                code: entry.code,
                label: `${entry.code} - ${entry.description || entry.name || entry.code}`
            }))
        );

        const loadCatalogOptions = async () => {
            setCatalogsLoading(true);
            setCatalogsError(null);
            try {
                const [families, categories, garmentTypes, classifications, materials, sizeCurves] = await Promise.all([
                    api.getAdminCatalogCached<AdminCatalogItem[]>('families'),
                    api.getAdminCatalogCached<AdminCatalogItem[]>('categories'),
                    api.getAdminCatalogCached<AdminCatalogItem[]>('garment-types'),
                    api.getAdminCatalogCached<AdminCatalogItem[]>('classifications'),
                    api.getAdminCatalogCached<AdminCatalogItem[]>('materials'),
                    api.getAdminCatalogCached<SizeCurveCatalogItem[]>('size-curves')
                ]);

                setFamilyOptions(mapCatalogItems(families));
                setCategoryOptions(mapCatalogItems(categories));
                setGarmentTypeOptions(mapCatalogItems(garmentTypes));
                setClassificationOptions(mapCatalogItems(classifications));
                setMaterialOptions(mapCatalogItems(materials));

                setSizeCurveOptions(sizeCurves.map((entry) => {
                    const values = (entry.values || []).map((value) => value.value).filter(Boolean);
                    return {
                        id: entry.id,
                        code: entry.code,
                        value: entry.id,
                        values,
                        label: values.length > 0
                            ? `${entry.code} - ${entry.description} (${values.join(',')})`
                            : `${entry.code} - ${entry.description}`
                    };
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
    const pendingMasterItems = state.currentFactura?.items.filter((item) => !item.articleId?.trim()) ?? [];
    const supplier = state.currentFactura?.supplierSnapshot
        ? {
            id: state.currentFactura.supplierSnapshot.id,
            code: state.currentFactura.supplierSnapshot.code,
            label: state.currentFactura.supplierSnapshot.label
        }
        : null;

    const handleDraftChange = (field: keyof ArticleDraftForm, value: string) => {
        if (isFinal) return;
        setArticleDraft((prev) => ({ ...prev, [field]: value }));
        if (selectedArticle && mapArticleToDraft(selectedArticle)[field] !== value) {
            setSelectedArticle(null);
        }
    };

    const handleArticleSelected = (article: ArticleResponse) => {
        if (isFinal) return;
        setSelectedArticle(article);
        setArticleDraft(mapArticleToDraft(article));
    };

    const handleFinishItem = () => {
        if (isFinal || !state.currentFactura || !selectedArticle) return;

        const selectedGarmentType = garmentTypeOptions.find((option) => option.id === selectedArticle.garmentTypeId);
        const selectedCurve = sizeCurveOptions.find((option) => option.id === selectedArticle.sizeCurveId);
        const curveValues = selectedArticle.sizeCurve.values;

        const newItem: FacturaItem = {
            articleId: selectedArticle.id,
            articleSnapshot: {
                sku: selectedArticle.sku,
                description: selectedArticle.description,
                supplier: {
                    id: selectedArticle.supplier.id,
                    code: selectedArticle.supplier.code,
                    label: selectedArticle.supplier.label
                },
                sizeCurve: {
                    id: selectedArticle.sizeCurve.id,
                    code: selectedArticle.sizeCurve.code,
                    label: selectedArticle.sizeCurve.label,
                    values: curveValues
                }
            },
            supplierLabel: selectedArticle.supplier.label,
            marca: selectedArticle.supplier.label,
            tipoPrenda: selectedGarmentType?.label || '',
            codigoArticulo: selectedArticle.sku,
            sizeCurveId: selectedArticle.sizeCurveId,
            curvaTalles: curveValues,
            garmentTypeSnapshot: selectedGarmentType
                ? { id: selectedGarmentType.id, code: selectedGarmentType.code, label: selectedGarmentType.label }
                : undefined,
            sizeCurveSnapshot: selectedCurve
                ? { id: selectedCurve.id, code: selectedCurve.code, label: selectedCurve.label, values: curveValues }
                : undefined,
            colores: draftColors
        };

        const updatedItems = [...(state.currentFactura.items || []), newItem];
        updateDraft({ items: updatedItems });
        setDraftColors([]);
        setSelectedArticle(null);
        setArticleDraft(INITIAL_ARTICLE_DRAFT);
        setStep('ARTICLE');
    };

    if (state.isLoading || !state.currentFactura) {
        return <div className={styles.loader}><Loader2 className={styles.spinner} /></div>;
    }

    return (
        <div className={styles.page}>
            <header className={styles.hero}>
                <button type="button" className={styles.backButton} onClick={() => navigate(-1)}>
                    <ArrowLeft size={18} />
                </button>
                <h1>Factura: {state.currentFactura.nroFactura}</h1>
                <p>{state.currentFactura.proveedor || 'Sin proveedor'} · Ítems: {state.currentFactura.items?.length || 0}</p>
                <div className={styles.heroRow}>
                    <span className={isFinal ? styles.statusFinal : styles.statusDraft}>{getEstadoLabel(state.currentFactura.estado)}</span>
                    <div className={styles.heroActions}>
                        <button onClick={() => navigate(`/facturas/${id}/summary`)} className={styles.summaryButton}>Ver resumen</button>
                    </div>
                </div>
            </header>

            {isFinal && (
                <div className={styles.noticeSuccess}><Lock size={16} /> La factura está finalizada y es de solo lectura.</div>
            )}

            {!isFinal && pendingMasterItems.length > 0 && (
                <div className={styles.noticeWarning}>
                    <AlertTriangle size={16} />
                    <div>
                        <p>Esta factura tiene {pendingMasterItems.length} ítem(s) legado sin artículo maestro. Podés guardarla como borrador, pero no vas a poder finalizarla hasta resolverlos.</p>
                    </div>
                </div>
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
                    supplier={supplier}
                    supplierLocked={(state.currentFactura.items?.length ?? 0) > 0}
                    selectedArticle={selectedArticle}
                    articleDraft={articleDraft}
                    familyOptions={familyOptions}
                    categoryOptions={categoryOptions}
                    garmentTypeOptions={garmentTypeOptions}
                    classificationOptions={classificationOptions}
                    materialOptions={materialOptions}
                    sizeCurveOptions={sizeCurveOptions}
                    catalogsLoading={catalogsLoading}
                    catalogsError={catalogsError}
                    onDraftChange={handleDraftChange}
                    onArticleSelected={handleArticleSelected}
                    onNext={() => !isFinal && selectedArticle && setStep('COLOR')}
                    onSupplierCreated={(createdSupplier) => {
                        setSelectedArticle(null);
                        setDraftColors([]);
                        setArticleDraft(INITIAL_ARTICLE_DRAFT);
                        updateDraft({
                            proveedor: createdSupplier.label,
                            supplierSnapshot: createdSupplier,
                            items: []
                        });
                    }}
                    readOnly={isFinal}
                />
            )}

            {step === 'COLOR' && selectedArticle && (
                <ColorStep
                    itemContext={{
                        supplierLabel: selectedArticle.supplier.label,
                        tipoPrenda: garmentTypeOptions.find((option) => option.id === selectedArticle.garmentTypeId)?.label || '-',
                        codigoArticulo: selectedArticle.sku,
                        curvaTalles: selectedArticle.sizeCurve.values
                    }}
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
