import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ApiError, api } from '../services/api';
import { ArticleResponse, CloneArticlePayload, CreateArticlePayload } from '../services/articlesApi';
import styles from './ArticlesPage.module.css';

type CatalogItem = {
    id: string;
    code: string;
    name?: string;
    description?: string;
};

type CatalogMap = {
    suppliers: CatalogItem[];
    families: CatalogItem[];
    materials: CatalogItem[];
    categories: CatalogItem[];
    classifications: CatalogItem[];
    garmentTypes: CatalogItem[];
    sizeCurves: CatalogItem[];
};

const emptyCatalogs: CatalogMap = {
    suppliers: [],
    families: [],
    materials: [],
    categories: [],
    classifications: [],
    garmentTypes: [],
    sizeCurves: []
};

const getCatalogLabel = (item: CatalogItem) => item.name || item.description || item.code;

const formatError = (error: unknown, fallback: string) => {
    if (error instanceof ApiError) {
        return `${error.message} [${error.code}]`;
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
};

const buildPayload = (form: CreateArticlePayload): CreateArticlePayload => ({
    sku: form.sku.trim(),
    description: form.description.trim(),
    supplierId: form.supplierId,
    familyId: form.familyId,
    materialId: form.materialId,
    categoryId: form.categoryId,
    classificationId: form.classificationId,
    garmentTypeId: form.garmentTypeId,
    sizeCurveId: form.sizeCurveId
});

export function ArticlesPage() {
    const navigate = useNavigate();
    const [catalogs, setCatalogs] = useState<CatalogMap>(emptyCatalogs);
    const [loadingCatalogs, setLoadingCatalogs] = useState(false);
    const [loadingArticles, setLoadingArticles] = useState(false);
    const [savingArticle, setSavingArticle] = useState(false);
    const [cloningArticleId, setCloningArticleId] = useState<string | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [articles, setArticles] = useState<ArticleResponse[]>([]);

    const [searchSupplierId, setSearchSupplierId] = useState('');
    const [query, setQuery] = useState('');

    const [form, setForm] = useState<CreateArticlePayload>({
        sku: '',
        description: '',
        supplierId: '',
        familyId: '',
        materialId: '',
        categoryId: '',
        classificationId: '',
        garmentTypeId: '',
        sizeCurveId: ''
    });

    const [cloneDrafts, setCloneDrafts] = useState<Record<string, CloneArticlePayload>>({});

    const suppliers = catalogs.suppliers;

    const selectedSupplier = useMemo(
        () => suppliers.find((supplier) => supplier.id === searchSupplierId),
        [searchSupplierId, suppliers]
    );

    const loadCatalogs = async () => {
        setLoadingCatalogs(true);
        setError(null);

        try {
            const [suppliersData, families, materials, categories, classifications, garmentTypes, sizeCurves] = await Promise.all([
                api.getAdminCatalogCached<CatalogItem[]>('suppliers', true),
                api.getAdminCatalogCached<CatalogItem[]>('families', true),
                api.getAdminCatalogCached<CatalogItem[]>('materials', true),
                api.getAdminCatalogCached<CatalogItem[]>('categories', true),
                api.getAdminCatalogCached<CatalogItem[]>('classifications', true),
                api.getAdminCatalogCached<CatalogItem[]>('garment-types', true),
                api.getAdminCatalogCached<CatalogItem[]>('size-curves', true)
            ]);

            setCatalogs({ suppliers: suppliersData, families, materials, categories, classifications, garmentTypes, sizeCurves });

            if (suppliersData.length > 0) {
                const initialSupplier = suppliersData[0].id;
                setSearchSupplierId(initialSupplier);
                setForm((prev) => ({ ...prev, supplierId: initialSupplier }));
            }
        } catch (err) {
            setError(formatError(err, 'No pudimos cargar catálogos para artículos'));
        } finally {
            setLoadingCatalogs(false);
        }
    };

    useEffect(() => {
        void loadCatalogs();
    }, []);

    const loadArticles = async (supplierId: string, q = '') => {
        if (!supplierId) {
            setError('Seleccioná un proveedor para buscar artículos.');
            return;
        }

        setLoadingArticles(true);
        setError(null);

        try {
            const response = await api.searchArticles({ supplierId, q, limit: 50 });
            setArticles(response.items);
        } catch (err) {
            setError(formatError(err, 'No pudimos buscar artículos'));
        } finally {
            setLoadingArticles(false);
        }
    };

    const onSearch = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await loadArticles(searchSupplierId, query);
    };

    const onCreateArticle = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSavingArticle(true);
        setError(null);

        try {
            const payload = buildPayload(form);
            const created = await api.createArticle(payload);
            setForm((prev) => ({ ...prev, sku: '', description: '' }));
            setSearchSupplierId(created.supplierId);
            await loadArticles(created.supplierId, query);
        } catch (err) {
            setError(formatError(err, 'No pudimos crear el artículo'));
        } finally {
            setSavingArticle(false);
        }
    };

    const onCloneArticle = async (articleId: string) => {
        const draft = cloneDrafts[articleId];
        if (!draft?.sku || !draft?.description) {
            setError('El clonado requiere SKU y descripción.');
            return;
        }

        setCloningArticleId(articleId);
        setError(null);

        try {
            await api.cloneArticle(articleId, {
                ...draft,
                sku: draft.sku.trim(),
                description: draft.description.trim()
            });
            setCloneDrafts((prev) => {
                const next = { ...prev };
                delete next[articleId];
                return next;
            });
            await loadArticles(searchSupplierId, query);
        } catch (err) {
            setError(formatError(err, 'No pudimos clonar el artículo'));
        } finally {
            setCloningArticleId(null);
        }
    };

    return (
        <section>
            <header className={styles.hero}>
                <button type="button" className={styles.backButton} onClick={() => navigate('/')}>
                    <ArrowLeft size={18} />
                </button>
                <h1>Artículos</h1>
                <p>Alta, búsqueda y clonado de artículos por proveedor.</p>
            </header>

            <div className={styles.content}>
                <form onSubmit={onSearch} className={styles.card}>
                    <p className={styles.label}>Buscar artículos</p>
                    <div className={styles.row}>
                        <select
                            className={styles.select}
                            value={searchSupplierId}
                            onChange={(event) => {
                                setSearchSupplierId(event.target.value);
                                setForm((prev) => ({ ...prev, supplierId: event.target.value }));
                            }}
                            required
                            disabled={loadingCatalogs}
                        >
                            <option value="">Seleccioná un proveedor</option>
                            {suppliers.map((supplier) => (
                                <option key={supplier.id} value={supplier.id}>
                                    {supplier.code} - {getCatalogLabel(supplier)}
                                </option>
                            ))}
                        </select>
                        <input
                            className={styles.input}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="SKU o descripción"
                        />
                    </div>
                    <button type="submit" className={styles.searchButton} disabled={loadingCatalogs || loadingArticles}>
                        {loadingArticles ? 'Buscando...' : 'Buscar'}
                    </button>
                    {selectedSupplier && <p className={styles.muted}>Proveedor activo: {selectedSupplier.code} - {getCatalogLabel(selectedSupplier)}</p>}
                </form>

                <form onSubmit={onCreateArticle} className={styles.card}>
                    <p className={styles.label}>Alta manual</p>
                    <div className={styles.row}>
                        <input className={styles.input} value={form.sku} onChange={(event) => setForm((prev) => ({ ...prev, sku: event.target.value }))} placeholder="SKU" required />
                        <input className={styles.input} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Description" required />
                    </div>
                    <div className={styles.row}>
                        <select className={styles.select} value={form.familyId} onChange={(event) => setForm((prev) => ({ ...prev, familyId: event.target.value }))} required>
                            <option value="">📁 Familia</option>
                            {catalogs.families.map((entry) => <option key={entry.id} value={entry.id}>{entry.code} - {getCatalogLabel(entry)}</option>)}
                        </select>
                        <select className={styles.select} value={form.materialId} onChange={(event) => setForm((prev) => ({ ...prev, materialId: event.target.value }))} required>
                            <option value="">🧵 Material</option>
                            {catalogs.materials.map((entry) => <option key={entry.id} value={entry.id}>{entry.code} - {getCatalogLabel(entry)}</option>)}
                        </select>
                    </div>
                    <div className={styles.row}>
                        <select className={styles.select} value={form.categoryId} onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))} required>
                            <option value="">🏷️ Categoría</option>
                            {catalogs.categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.code} - {getCatalogLabel(entry)}</option>)}
                        </select>
                        <select className={styles.select} value={form.classificationId} onChange={(event) => setForm((prev) => ({ ...prev, classificationId: event.target.value }))} required>
                            <option value="">📚 Clasificación</option>
                            {catalogs.classifications.map((entry) => <option key={entry.id} value={entry.id}>{entry.code} - {getCatalogLabel(entry)}</option>)}
                        </select>
                    </div>
                    <div className={styles.row}>
                        <select className={styles.select} value={form.garmentTypeId} onChange={(event) => setForm((prev) => ({ ...prev, garmentTypeId: event.target.value }))} required>
                            <option value="">👕 Tipo de prenda</option>
                            {catalogs.garmentTypes.map((entry) => <option key={entry.id} value={entry.id}>{entry.code} - {getCatalogLabel(entry)}</option>)}
                        </select>
                        <select className={styles.select} value={form.sizeCurveId} onChange={(event) => setForm((prev) => ({ ...prev, sizeCurveId: event.target.value }))} required>
                            <option value="">📏 Curva de talles</option>
                            {catalogs.sizeCurves.map((entry) => <option key={entry.id} value={entry.id}>{entry.code} - {getCatalogLabel(entry)}</option>)}
                        </select>
                    </div>
                    <button type="submit" className={styles.primaryButton} disabled={savingArticle || loadingCatalogs}>
                        {savingArticle ? 'Guardando...' : 'Crear artículo'}
                    </button>
                </form>

                {error && <p className={styles.error}>{error}</p>}

                <div className={styles.articleList}>
                    {articles.map((article) => {
                        const draft = cloneDrafts[article.id] ?? { sku: '', description: '' };
                        return (
                            <article key={article.id} className={styles.articleCard}>
                                <div className={styles.articleHeader}>
                                    <div>
                                        <p className={styles.sku}>{article.sku} · {article.description}</p>
                                        <p className={styles.meta}>Curva: {article.sizeCurve.code} ({article.sizeCurve.values.join('-')})</p>
                                    </div>
                                </div>

                                <div className={styles.cloneForm}>
                                    <p className={styles.label}>Clonar desde base</p>
                                    <div className={styles.row}>
                                        <input
                                            className={styles.input}
                                            placeholder="New SKU"
                                            value={draft.sku}
                                            onChange={(event) => setCloneDrafts((prev) => ({
                                                ...prev,
                                                [article.id]: { ...draft, sku: event.target.value }
                                            }))}
                                        />
                                        <input
                                            className={styles.input}
                                            placeholder="New description"
                                            value={draft.description}
                                            onChange={(event) => setCloneDrafts((prev) => ({
                                                ...prev,
                                                [article.id]: { ...draft, description: event.target.value }
                                            }))}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        onClick={() => void onCloneArticle(article.id)}
                                        disabled={cloningArticleId === article.id}
                                    >
                                        {cloningArticleId === article.id ? 'Clonando...' : 'Clonar artículo'}
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                    {!loadingArticles && articles.length === 0 && <p className={styles.muted}>No hay artículos para mostrar.</p>}
                </div>
            </div>

        </section>
    );
}
