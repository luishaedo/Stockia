import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, PackagePlus, Pencil, Search, X } from 'lucide-react';
import { ArticleResponse, CreateArticlePayload } from '../../services/articlesApi';
import { ApiError, api } from '../../services/api';
import { SupplierCreateModal } from './SupplierCreateModal';
import styles from './ArticleStep.module.css';

type Option = { value: string; label: string; id?: string; code?: string };
export type SupplierOption = { id: string; code: string; label: string };
type SupplierCatalogItem = { id: string; label: string; logoUrl?: string | null };

type ArticleModalMode = 'create' | 'clone';

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
    subtitle?: string;
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
    const [articleModalOpen, setArticleModalOpen] = useState(false);
    const [articleModalMode, setArticleModalMode] = useState<ArticleModalMode>('create');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ArticleResponse[]>([]);
    const [searchHint, setSearchHint] = useState<string | null>(null);
    const [cloneSearchQuery, setCloneSearchQuery] = useState('');
    const [cloneSearchResults, setCloneSearchResults] = useState<ArticleResponse[]>([]);
    const [cloneSearchHint, setCloneSearchHint] = useState<string | null>(null);
    const [selectedCloneBase, setSelectedCloneBase] = useState<ArticleResponse | null>(null);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [createError, setCreateError] = useState<string | null>(null);
    const [cloneError, setCloneError] = useState<string | null>(null);
    const [savingArticle, setSavingArticle] = useState(false);
    const [cloningArticleId, setCloningArticleId] = useState<string | null>(null);
    const [supplierLogoUrl, setSupplierLogoUrl] = useState<string | null>(null);
    const [supplierLogoError, setSupplierLogoError] = useState(false);

    useEffect(() => {
        setSearchResults([]);
        setSearchQuery('');
        setSearchError(null);
        setSearchHint(null);
        setCloneSearchQuery('');
        setCloneSearchResults([]);
        setCloneSearchHint(null);
        setSelectedCloneBase(null);
        setSupplierLogoUrl(null);
        setSupplierLogoError(false);
    }, [supplier?.id]);

    useEffect(() => {
        if (!supplier?.id) {
            setSupplierLogoUrl(null);
            return;
        }

        let cancelled = false;
        const loadSupplierLogo = async () => {
            try {
                const suppliers = await api.getAdminCatalogCached<SupplierCatalogItem[]>('suppliers');
                const supplierData = suppliers.find((item) => item.id === supplier.id);
                if (!cancelled) {
                    setSupplierLogoUrl(supplierData?.logoUrl ? api.resolveAssetUrl(supplierData.logoUrl) : null);
                }
            } catch {
                if (!cancelled) {
                    setSupplierLogoUrl(null);
                }
            }
        };

        void loadSupplierLogo();

        return () => {
            cancelled = true;
        };
    }, [supplier?.id]);

    useEffect(() => {
        if (!supplier?.id || readOnly) {
            return;
        }

        const normalizedQuery = searchQuery.trim();
        if (!normalizedQuery) {
            setSearchResults([]);
            setSearchError(null);
            setSearchHint(null);
            return;
        }

        if (normalizedQuery.length < 3) {
            setSearchResults([]);
            setSearchError(null);
            setSearchHint('Ingresá al menos 3 caracteres.');
            return;
        }

        const timeoutId = window.setTimeout(() => {
            void searchArticles(normalizedQuery, {
                silent: true,
                setResults: setSearchResults,
                setHint: setSearchHint
            });
        }, 350);

        return () => window.clearTimeout(timeoutId);
    }, [searchQuery, supplier?.id, readOnly]);

    useEffect(() => {
        if (articleModalMode !== 'clone' || !supplier?.id || readOnly) {
            return;
        }

        const normalizedQuery = cloneSearchQuery.trim();
        if (!normalizedQuery || normalizedQuery.length < 3) {
            setCloneSearchResults([]);
            setSearchError(null);
            setCloneSearchHint('Ingresá al menos 3 caracteres.');
            return;
        }

        const timeoutId = window.setTimeout(() => {
            void searchArticles(normalizedQuery, {
                silent: true,
                setResults: setCloneSearchResults,
                setHint: setCloneSearchHint
            });
        }, 350);

        return () => window.clearTimeout(timeoutId);
    }, [articleModalMode, cloneSearchQuery, supplier?.id, readOnly]);

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

    const canCloneArticle = Boolean(
        articleDraft.sku.trim()
        && articleDraft.description.trim()
        && !catalogBlockReason
    );

    const searchArticles = async (
        query: string,
        options: {
            silent?: boolean;
            setResults?: (items: ArticleResponse[]) => void;
            setHint?: (value: string | null) => void;
        } = {}
    ) => {
        const { silent = false, setResults = setSearchResults, setHint } = options;
        if (!supplier?.id) {
            if (!silent) {
                setSearchError('Primero necesitás un proveedor activo para buscar artículos.');
            }
            return;
        }

        const normalizedQuery = query.trim();
        if (normalizedQuery.length < 3) {
            setResults([]);
            setHint?.('Ingresá al menos 3 caracteres.');
            if (!silent) {
                setSearchError(null);
            }
            return;
        }

        setSearching(true);
        setSearchError(null);
        setHint?.(null);
        try {
            const response = await api.searchArticles({ supplierId: supplier.id, q: normalizedQuery, limit: 20 });
            setResults(response.items);
        } catch (error) {
            if (!silent) {
                setSearchError(getErrorMessage(error, 'No pudimos buscar artículos.'));
            }
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
            onDraftChange('sku', created.sku);
            onDraftChange('description', created.description);
            setArticleModalOpen(false);
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
            onDraftChange('sku', cloned.sku);
            onDraftChange('description', cloned.description);
            setArticleModalOpen(false);
        } catch (error) {
            setCloneError(getErrorMessage(error, 'No pudimos clonar el artículo.'));
        } finally {
            setCloningArticleId(null);
        }
    };

    const handleUseArticle = (article: ArticleResponse) => {
        onArticleSelected(article);
        onDraftChange('sku', article.sku);
        onDraftChange('description', article.description);
        setSearchQuery(article.sku);
    };

    const handleSelectCloneBase = (baseArticle: ArticleResponse) => {
        setSelectedCloneBase(baseArticle);
        onDraftChange('description', baseArticle.description);
        onDraftChange('familyId', baseArticle.familyId ?? '');
        onDraftChange('categoryId', baseArticle.categoryId ?? '');
        onDraftChange('garmentTypeId', baseArticle.garmentTypeId ?? '');
        onDraftChange('classificationId', baseArticle.classificationId ?? '');
        onDraftChange('materialId', baseArticle.materialId ?? '');
        onDraftChange('sizeCurveId', baseArticle.sizeCurveId ?? '');
        onDraftChange('sku', '');
    };

    const supplierInitial = supplier?.label.charAt(0).toUpperCase() ?? '?';

    return (
        <section className={styles.wrapper}>
            <div className={styles.header}>
                <div>
                    <h2>{title}</h2>
                    {subtitle ? <p>{subtitle}</p> : null}
                </div>
                <button
                    type="button"
                    className={styles.supplierAvatarButton}
                    onClick={() => canManageSupplier && setSupplierModalOpen(true)}
                    disabled={!canManageSupplier}
                    title={canManageSupplier ? 'Editar proveedor' : supplier ? `${supplier.code} · ${supplier.label}` : 'Sin proveedor'}
                >
                    {supplierLogoUrl && !supplierLogoError ? (
                        <img
                            src={supplierLogoUrl}
                            alt={supplier?.label ?? 'Proveedor'}
                            className={styles.supplierAvatarImage}
                            onError={() => setSupplierLogoError(true)}
                        />
                    ) : (
                        <span className={styles.supplierAvatarFallback}>{supplierInitial}</span>
                    )}
                    {canManageSupplier ? (
                        <span className={styles.supplierAvatarOverlay}>
                            <Pencil size={14} />
                        </span>
                    ) : null}
                </button>
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

            <div className={styles.layoutSingleColumn}>
                <article className={styles.panel}>
                    <div className={styles.panelHeaderCompact}>
                        <Search size={18} />
                        <h3>SKU</h3>
                    </div>

                    <div className={styles.searchRowCompact}>
                        <input
                            value={searchQuery}
                            onChange={(event) => {
                                const value = event.target.value;
                                setSearchQuery(value);
                                onDraftChange('sku', value);
                            }}
                            placeholder="SKU"
                            disabled={readOnly || !supplier?.id}
                        />
                        <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => {
                                setCreateError(null);
                                setCloneError(null);
                                setArticleModalMode('create');
                                setCloneSearchQuery('');
                                setCloneSearchResults([]);
                                setCloneSearchHint(null);
                                setSelectedCloneBase(null);
                                setArticleModalOpen(true);
                            }}
                            disabled={readOnly || !supplier?.id}
                            aria-label="Abrir opciones de nuevo o clonar"
                        >
                            <PackagePlus size={18} />
                        </button>
                    </div>

                    {searchError && <p className={styles.errorText}>{searchError}</p>}
                    {searchHint && !searchError && <p className={styles.emptyState}>{searchHint}</p>}

                    {searchQuery.trim().length >= 3 && (
                        <div className={styles.resultsList}>
                            {searching ? <p className={styles.emptyState}>Buscando…</p> : null}
                            {!searching && searchResults.length === 0 ? (
                                <p className={styles.emptyState}>Sin coincidencias para ese SKU.</p>
                            ) : null}

                            {!searching && searchResults.map((article) => (
                                <div key={article.id} className={selectedArticle?.id === article.id ? styles.resultCardActive : styles.resultCard}>
                                    <div>
                                        <strong>{article.sku}</strong>
                                        <p>{article.description}</p>
                                    </div>
                                    <div className={styles.resultActions}>
                                        <button type="button" className={styles.secondaryButton} onClick={() => handleUseArticle(article)} disabled={readOnly}>
                                            Usar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
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
                        <strong>{selectedArticle.sku}</strong>
                        <p>{selectedArticle.description}</p>
                        <dl className={styles.selectionMeta}>
                            <div>
                                <dt>Proveedor</dt>
                                <dd>{selectedArticle.supplier.code} · {selectedArticle.supplier.label}</dd>
                            </div>
                            <div>
                                <dt>Familia</dt>
                                <dd>{getOptionLabel(familyOptions, selectedArticle.familyId)}</dd>
                            </div>
                            <div>
                                <dt>Material</dt>
                                <dd>{getOptionLabel(materialOptions, selectedArticle.materialId)}</dd>
                            </div>
                        </dl>
                    </div>
                ) : (
                    <p className={styles.emptyState}>Seleccioná, creá o cloná un artículo para continuar.</p>
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
                        setSupplierModalOpen(false);
                    }}
                />
            )}

            {articleModalOpen && (
                <div className={styles.modalBackdrop} role="presentation" onClick={() => setArticleModalOpen(false)}>
                    <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="article-modal-title" onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 id="article-modal-title">Artículo</h3>
                            <div className={styles.modalModes}>
                                <button
                                    type="button"
                                    className={articleModalMode === 'create' ? styles.modalModeActive : styles.modalModeButton}
                                    onClick={() => setArticleModalMode('create')}
                                >
                                    Nuevo
                                </button>
                                <button
                                    type="button"
                                    className={articleModalMode === 'clone' ? styles.modalModeActive : styles.modalModeButton}
                                    onClick={() => setArticleModalMode('clone')}
                                >
                                    Clonar
                                </button>
                            </div>
                            <button
                                type="button"
                                className={styles.modalCloseButton}
                                onClick={() => setArticleModalOpen(false)}
                                aria-label="Cerrar modal de artículo"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {articleModalMode === 'clone' && (
                            <div className={styles.modalCloneList}>
                                <label className={styles.cloneSearchLabel}>
                                    <span>SKU a clonar</span>
                                    <div className={styles.cloneSearchBar}>
                                        <Search size={18} aria-hidden="true" />
                                        <input
                                            value={cloneSearchQuery}
                                            onChange={(event) => {
                                                const value = event.target.value;
                                                setCloneSearchQuery(value);
                                                if (value.trim().length < 3) {
                                                    setCloneSearchResults([]);
                                                    setCloneSearchHint('Ingresá al menos 3 caracteres.');
                                                }
                                            }}
                                            placeholder="Buscar"
                                            disabled={readOnly || !supplier?.id}
                                        />
                                        <button
                                            type="button"
                                            className={styles.cloneSearchButton}
                                            onClick={() => setCloneSearchQuery((previous) => previous.trim())}
                                            disabled={readOnly || !supplier?.id || !cloneSearchQuery.trim()}
                                        >
                                            Buscar
                                        </button>
                                    </div>
                                </label>
                                {cloneSearchHint && !searchError && <p className={styles.emptyState}>{cloneSearchHint}</p>}
                                {cloneSearchResults.map((article) => (
                                    <div key={`clone-base-${article.id}`} className={selectedCloneBase?.id === article.id ? styles.resultCardActive : styles.resultCard}>
                                        <div>
                                            <strong>{article.sku}</strong>
                                            <p>{article.description}</p>
                                        </div>
                                        <button
                                            type="button"
                                            className={styles.secondaryButton}
                                            onClick={() => handleSelectCloneBase(article)}
                                            disabled={readOnly}
                                        >
                                            Seleccionar
                                        </button>
                                    </div>
                                ))}
                                {!searching && cloneSearchQuery.trim().length >= 3 && cloneSearchResults.length === 0 && (
                                    <p className={styles.emptyState}>Sin coincidencias para ese SKU base.</p>
                                )}
                            </div>
                        )}

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

                        {articleModalMode === 'create' ? (
                            <button type="button" className={styles.primaryButton} onClick={() => void createInlineArticle()} disabled={readOnly || savingArticle || !canCreateArticle}>
                                <PackagePlus size={16} />
                                {savingArticle ? 'Creando artículo…' : 'Crear nuevo'}
                            </button>
                        ) : (
                            <>
                                {selectedCloneBase ? (
                                    <p className={styles.emptyState}>Base seleccionada: <strong>{selectedCloneBase.sku}</strong></p>
                                ) : (
                                    <p className={styles.emptyState}>Seleccioná una base para habilitar el clonado.</p>
                                )}
                                <button
                                    type="button"
                                    className={styles.primaryButton}
                                    onClick={() => selectedCloneBase && void cloneFromBaseArticle(selectedCloneBase)}
                                    disabled={readOnly || !canCloneArticle || !selectedCloneBase || cloningArticleId === selectedCloneBase?.id}
                                >
                                    <PackagePlus size={16} />
                                    {cloningArticleId === selectedCloneBase?.id ? 'Clonando…' : 'Clonar desde base'}
                                </button>
                            </>
                        )}

                        {(createError || cloneError) && <p className={styles.errorText}>{createError || cloneError}</p>}
                    </div>
                </div>
            )}
        </section>
    );
}
