import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, PackagePlus, Search, Store } from 'lucide-react';
import { ArticleResponse, CreateArticlePayload } from '../../services/articlesApi';
import { ApiError, api } from '../../services/api';
import { SupplierCreateModal } from './SupplierCreateModal';
import styles from './ArticleStep.module.css';

type Option = { value: string; label: string; id?: string; code?: string };
export type SupplierOption = { id: string; code: string; label: string };

export interface ArticleDraftForm {
    sku: string;
    description: string;
    familyId: string;
    categoryId: string;
    garmentTypeId: string;
    classificationId: string;
    materialId: string;
    sizeCurveId: string;
}

interface MasterArticleResolverProps {
    title: string;
    subtitle: string;
    confirmLabel: string;
    supplier?: SupplierOption | null;
    supplierLocked?: boolean;
    allowSupplierCreation?: boolean;
    selectedArticle: ArticleResponse | null;
    articleDraft: ArticleDraftForm;
    familyOptions: Option[];
    categoryOptions: Option[];
    garmentTypeOptions: Option[];
    classificationOptions: Option[];
    materialOptions: Option[];
    sizeCurveOptions: Option[];
    catalogsLoading: boolean;
    catalogsError: string | null;
    onDraftChange: (field: keyof ArticleDraftForm, value: string) => void;
    onArticleSelected: (article: ArticleResponse) => void;
    onConfirm: () => void;
    onSupplierCreated?: (supplier: SupplierOption) => void;
    readOnly?: boolean;
}

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof ApiError) {
        return `${error.message} [${error.code}]`;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return fallback;
};

const getOptionLabel = (options: Option[], value: string) => options.find((option) => option.value === value)?.label ?? '-';

export function MasterArticleResolver({
    title,
    subtitle,
    confirmLabel,
    supplier,
    supplierLocked = false,
    allowSupplierCreation = false,
    selectedArticle,
    articleDraft,
    familyOptions,
    categoryOptions,
    garmentTypeOptions,
    classificationOptions,
    materialOptions,
    sizeCurveOptions,
    catalogsLoading,
    catalogsError,
    onDraftChange,
    onArticleSelected,
    onConfirm,
    onSupplierCreated,
    readOnly = false
}: MasterArticleResolverProps) {
    const [supplierModalOpen, setSupplierModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ArticleResponse[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [createError, setCreateError] = useState<string | null>(null);
    const [cloneError, setCloneError] = useState<string | null>(null);
    const [savingArticle, setSavingArticle] = useState(false);
    const [cloningArticleId, setCloningArticleId] = useState<string | null>(null);

    useEffect(() => {
        setSearchResults([]);
        setSearchQuery('');
        setSearchError(null);
    }, [supplier?.id]);

    const missingCatalogs = useMemo(() => {
        const groups = [familyOptions, categoryOptions, garmentTypeOptions, classificationOptions, materialOptions, sizeCurveOptions];
        return groups.some((options) => options.length === 0);
    }, [familyOptions, categoryOptions, garmentTypeOptions, classificationOptions, materialOptions, sizeCurveOptions]);

    const catalogBlockReason = catalogsError
        || (missingCatalogs ? 'Faltan catálogos obligatorios para crear o clonar artículos.' : null);

    const canManageSupplier = allowSupplierCreation && !readOnly && !supplierLocked && Boolean(onSupplierCreated);
    const canCreateArticle = Boolean(
        supplier?.id
        && articleDraft.sku.trim()
        && articleDraft.description.trim()
        && articleDraft.familyId
        && articleDraft.categoryId
        && articleDraft.garmentTypeId
        && articleDraft.classificationId
        && articleDraft.materialId
        && articleDraft.sizeCurveId
        && !catalogBlockReason
    );

    const searchArticles = async () => {
        if (!supplier?.id) {
            setSearchError('Primero necesitás un proveedor activo para buscar artículos.');
            return;
        }

        setSearching(true);
        setSearchError(null);
        try {
            const response = await api.searchArticles({ supplierId: supplier.id, q: searchQuery.trim(), limit: 20 });
            setSearchResults(response.items);
        } catch (error) {
            setSearchError(getErrorMessage(error, 'No pudimos buscar artículos.'));
        } finally {
            setSearching(false);
        }
    };

    const createInlineArticle = async () => {
        if (!supplier?.id) {
            setCreateError('No hay proveedor seleccionado para crear el artículo.');
            return;
        }

        const payload: CreateArticlePayload = {
            sku: articleDraft.sku.trim(),
            description: articleDraft.description.trim(),
            supplierId: supplier.id,
            familyId: articleDraft.familyId,
            materialId: articleDraft.materialId,
            categoryId: articleDraft.categoryId,
            classificationId: articleDraft.classificationId,
            garmentTypeId: articleDraft.garmentTypeId,
            sizeCurveId: articleDraft.sizeCurveId
        };

        setSavingArticle(true);
        setCreateError(null);
        try {
            const created = await api.createArticle(payload);
            onArticleSelected(created);
            setSearchResults((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
            setSearchQuery(created.sku);
        } catch (error) {
            setCreateError(getErrorMessage(error, 'No pudimos crear el artículo.'));
        } finally {
            setSavingArticle(false);
        }
    };

    const cloneFromBaseArticle = async (baseArticle: ArticleResponse) => {
        setCloningArticleId(baseArticle.id);
        setCloneError(null);
        try {
            const cloned = await api.cloneArticle(baseArticle.id, {
                sku: articleDraft.sku.trim(),
                description: articleDraft.description.trim(),
                supplierId: supplier?.id,
                familyId: articleDraft.familyId || undefined,
                materialId: articleDraft.materialId || undefined,
                categoryId: articleDraft.categoryId || undefined,
                classificationId: articleDraft.classificationId || undefined,
                garmentTypeId: articleDraft.garmentTypeId || undefined,
                sizeCurveId: articleDraft.sizeCurveId || undefined
            });
            onArticleSelected(cloned);
            setSearchResults((prev) => [cloned, ...prev.filter((item) => item.id !== cloned.id)]);
            setSearchQuery(cloned.sku);
        } catch (error) {
            setCloneError(getErrorMessage(error, 'No pudimos clonar el artículo.'));
        } finally {
            setCloningArticleId(null);
        }
    };

    return (
        <section className={styles.wrapper}>
            <div className={styles.header}>
                <div>
                    <h2>{title}</h2>
                    <p>{subtitle}</p>
                </div>
                <div className={styles.supplierBox}>
                    <span className={styles.supplierLabel}>Proveedor actual</span>
                    <strong>{supplier ? `${supplier.code} · ${supplier.label}` : 'Sin proveedor'}</strong>
                    {allowSupplierCreation && (
                        <button type="button" className={styles.inlineButton} onClick={() => setSupplierModalOpen(true)} disabled={!canManageSupplier}>
                            <Store size={16} />
                            {supplier ? 'Crear y usar otro proveedor' : 'Crear proveedor'}
                        </button>
                    )}
                </div>
            </div>

            {allowSupplierCreation && !canManageSupplier && (
                <div className={styles.infoBanner}>
                    <AlertCircle size={16} />
                    <span>El proveedor no puede cambiarse cuando la factura ya tiene ítems o está en solo lectura.</span>
                </div>
            )}

            {catalogBlockReason && (
                <div className={styles.warningBanner}>
                    <AlertCircle size={16} />
                    <span>{catalogBlockReason}</span>
                </div>
            )}

            <div className={styles.layout}>
                <article className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <Search size={18} />
                        <div>
                            <h3>Buscar y seleccionar existente</h3>
                            <p>Filtrá por SKU o descripción dentro del proveedor actual.</p>
                        </div>
                    </div>

                    <div className={styles.searchRow}>
                        <input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Ej: NK-1002 o Remera deportiva"
                            disabled={readOnly || !supplier?.id}
                        />
                        <button type="button" className={styles.primaryButton} onClick={() => void searchArticles()} disabled={readOnly || searching || !supplier?.id}>
                            {searching ? 'Buscando...' : 'Buscar'}
                        </button>
                    </div>

                    {searchError && <p className={styles.errorText}>{searchError}</p>}

                    <div className={styles.resultsList}>
                        {searchResults.map((article) => (
                            <div key={article.id} className={selectedArticle?.id === article.id ? styles.resultCardActive : styles.resultCard}>
                                <div>
                                    <strong>{article.sku}</strong>
                                    <p>{article.description}</p>
                                    <small>Curva: {article.sizeCurve.code} · {article.sizeCurve.values.join(', ')}</small>
                                </div>
                                <div className={styles.resultActions}>
                                    <button type="button" className={styles.secondaryButton} onClick={() => onArticleSelected(article)} disabled={readOnly}>
                                        Usar artículo
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        onClick={() => void cloneFromBaseArticle(article)}
                                        disabled={readOnly || !articleDraft.sku.trim() || !articleDraft.description.trim() || Boolean(catalogBlockReason) || cloningArticleId === article.id}
                                    >
                                        {cloningArticleId === article.id ? 'Clonando...' : 'Clonar desde este'}
                                    </button>
                                </div>
                            </div>
                        ))}

                        {!searching && searchResults.length === 0 && (
                            <p className={styles.emptyState}>No hay resultados todavía. Ejecutá una búsqueda o creá un artículo inline.</p>
                        )}
                    </div>

                    {cloneError && <p className={styles.errorText}>{cloneError}</p>}
                </article>

                <article className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <PackagePlus size={18} />
                        <div>
                            <h3>Crear o clonar inline</h3>
                            <p>Completá el maestro desde cero o prepará los datos para clonar desde un artículo base.</p>
                        </div>
                    </div>

                    <div className={styles.formGrid}>
                        <label>
                            <span>SKU</span>
                            <input value={articleDraft.sku} onChange={(event) => onDraftChange('sku', event.target.value)} disabled={readOnly} />
                        </label>
                        <label>
                            <span>Descripción</span>
                            <input value={articleDraft.description} onChange={(event) => onDraftChange('description', event.target.value)} disabled={readOnly} />
                        </label>
                        <label>
                            <span>Familia</span>
                            <select value={articleDraft.familyId} onChange={(event) => onDraftChange('familyId', event.target.value)} disabled={readOnly || catalogsLoading}>
                                <option value="">Seleccionar</option>
                                {familyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </label>
                        <label>
                            <span>Categoría</span>
                            <select value={articleDraft.categoryId} onChange={(event) => onDraftChange('categoryId', event.target.value)} disabled={readOnly || catalogsLoading}>
                                <option value="">Seleccionar</option>
                                {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </label>
                        <label>
                            <span>Tipo de prenda</span>
                            <select value={articleDraft.garmentTypeId} onChange={(event) => onDraftChange('garmentTypeId', event.target.value)} disabled={readOnly || catalogsLoading}>
                                <option value="">Seleccionar</option>
                                {garmentTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </label>
                        <label>
                            <span>Clasificación</span>
                            <select value={articleDraft.classificationId} onChange={(event) => onDraftChange('classificationId', event.target.value)} disabled={readOnly || catalogsLoading}>
                                <option value="">Seleccionar</option>
                                {classificationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </label>
                        <label>
                            <span>Material</span>
                            <select value={articleDraft.materialId} onChange={(event) => onDraftChange('materialId', event.target.value)} disabled={readOnly || catalogsLoading}>
                                <option value="">Seleccionar</option>
                                {materialOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </label>
                        <label>
                            <span>Curva</span>
                            <select value={articleDraft.sizeCurveId} onChange={(event) => onDraftChange('sizeCurveId', event.target.value)} disabled={readOnly || catalogsLoading}>
                                <option value="">Seleccionar</option>
                                {sizeCurveOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </label>
                    </div>

                    <button type="button" className={styles.primaryButton} onClick={() => void createInlineArticle()} disabled={readOnly || savingArticle || !canCreateArticle}>
                        <PackagePlus size={16} />
                        {savingArticle ? 'Creando artículo...' : 'Crear artículo inline'}
                    </button>

                    {createError && <p className={styles.errorText}>{createError}</p>}
                </article>
            </div>

            <article className={styles.selectionPanel}>
                <div className={styles.panelHeader}>
                    <CheckCircle2 size={18} />
                    <div>
                        <h3>Artículo listo para el ítem</h3>
                        <p>La confirmación aplica este maestro sobre el ítem actual.</p>
                    </div>
                </div>

                {selectedArticle ? (
                    <div className={styles.selectionCard}>
                        <div>
                            <strong>{selectedArticle.sku}</strong>
                            <p>{selectedArticle.description}</p>
                        </div>
                        <dl className={styles.selectionMeta}>
                            <div>
                                <dt>Tipo</dt>
                                <dd>{getOptionLabel(garmentTypeOptions, selectedArticle.garmentTypeId)}</dd>
                            </div>
                            <div>
                                <dt>Curva</dt>
                                <dd>{selectedArticle.sizeCurve.code} · {selectedArticle.sizeCurve.values.join(', ')}</dd>
                            </div>
                            <div>
                                <dt>Proveedor</dt>
                                <dd>{selectedArticle.supplier.code} · {selectedArticle.supplier.label}</dd>
                            </div>
                        </dl>
                    </div>
                ) : (
                    <p className={styles.emptyState}>Todavía no seleccionaste ningún artículo maestro.</p>
                )}

                <button type="button" className={styles.nextButton} onClick={onConfirm} disabled={!selectedArticle || readOnly}>
                    {confirmLabel}
                </button>
            </article>

            {allowSupplierCreation && onSupplierCreated && (
                <SupplierCreateModal
                    isOpen={supplierModalOpen}
                    onClose={() => setSupplierModalOpen(false)}
                    onCreated={(created) => {
                        onSupplierCreated({ id: created.id, code: created.code, label: created.name });
                        setSearchResults([]);
                    }}
                />
            )}
        </section>
    );
}
