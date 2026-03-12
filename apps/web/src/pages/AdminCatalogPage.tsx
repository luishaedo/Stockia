import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { api, ApiError } from '../services/api';
import styles from './AdminCatalogPage.module.css';
import { FileUploadField } from '../components/ui/FileUploadField';
import { AttributesModal } from '../components/attributes/AttributesModal';

type CatalogKey = 'suppliers' | 'size-curves' | 'families' | 'categories' | 'garment-types' | 'materials' | 'classifications';

type CatalogItem = {
    id: string;
    code: string;
    name?: string;
    description?: string;
    logoUrl?: string | null;
    longDescription?: string | null;
    values?: { value: string; sortOrder: number }[];
};

const catalogOptions: Array<{ key: CatalogKey; label: string; emoji: string }> = [
    { key: 'suppliers', label: 'Proveedores', emoji: '🏢' },
    { key: 'size-curves', label: 'Curvas de talles', emoji: '📏' },
    { key: 'garment-types', label: 'Tipos de prenda', emoji: '👕' },
    { key: 'families', label: 'Familias', emoji: '📁' },
    { key: 'categories', label: 'Categorías', emoji: '🏷️' },
    { key: 'materials', label: 'Materiales', emoji: '🧵' },
    { key: 'classifications', label: 'Clasificaciones', emoji: '📚' }
];

const getDisplayDescription = (item: CatalogItem) => item.name || item.description || '';

const formatCatalogError = (error: unknown, fallback: string) => {
    if (error instanceof ApiError) {
        const traceInfo = error.traceId ? ` (traceId: ${error.traceId})` : '';
        return `${error.message} [${error.code}]${traceInfo}`;
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
};

export function AdminCatalogPage() {
    const navigate = useNavigate();
    const [selectedCatalog, setSelectedCatalog] = useState<CatalogKey>('suppliers');
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [selectedLogoFileName, setSelectedLogoFileName] = useState('Ningún archivo seleccionado');

    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [longDescription, setLongDescription] = useState('');
    const [sizeValues, setSizeValues] = useState('');
    const [attributesModalOpen, setAttributesModalOpen] = useState(false);

    const isSupplier = selectedCatalog === 'suppliers';
    const isCategory = selectedCatalog === 'categories';
    const isSizeCurve = selectedCatalog === 'size-curves';
    const requiresLogo = isSupplier;

    const title = useMemo(() => catalogOptions.find((option) => option.key === selectedCatalog)?.label ?? selectedCatalog, [selectedCatalog]);

    const resetForm = () => {
        setEditingId(null);
        setCode('');
        setDescription('');
        setLogoUrl('');
        setSelectedLogoFileName('Ningún archivo seleccionado');
        setLongDescription('');
        setSizeValues('');
    };

    const loadItems = async (catalog: CatalogKey) => {
        setLoading(true);
        setError(null);

        try {
            const data = await api.getAdminCatalogCached<CatalogItem[]>(catalog, true);
            setItems(data);
        } catch (err) {
            const message = formatCatalogError(err, 'No pudimos cargar el catálogo');
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        resetForm();
        void loadItems(selectedCatalog);

        const nextCatalogs = catalogOptions.map((option) => option.key).filter((catalog) => catalog !== selectedCatalog);
        void api.preloadAdminCatalogsIncremental(nextCatalogs);
    }, [selectedCatalog]);

    const handleEdit = (item: CatalogItem) => {
        setEditingId(item.id);
        setCode(item.code);
        setDescription(item.name || item.description || '');
        setLogoUrl(item.logoUrl || '');
        setLongDescription(item.longDescription || '');
        setSizeValues(item.values?.map((entry) => entry.value).join(',') || '');
    };

    const handleLogoUpload = async (file?: File) => {
        if (!file) return;
        setSelectedLogoFileName(file.name);
        setUploadingLogo(true);
        setError(null);

        try {
            const response = await api.uploadAdminLogo(file);
            setLogoUrl(response.url);
        } catch (err) {
            const message = formatCatalogError(err, 'No pudimos subir el logo');
            setError(message);
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        const trimmedCode = code.trim();
        const trimmedDescription = description.trim();

        if (!trimmedCode || !trimmedDescription) {
            setError('Código y descripción/nombre no pueden estar vacíos.');
            return;
        }

        const payload: Record<string, unknown> = {
            code: trimmedCode,
            ...(isSupplier ? { name: trimmedDescription } : { description: trimmedDescription })
        };
        if (isSupplier && logoUrl.trim()) payload.logoUrl = logoUrl.trim();
        if (isCategory) payload.longDescription = longDescription.trim();

        if (isSizeCurve) {
            const parsedValues = sizeValues.split(',').map((value) => value.trim()).filter(Boolean);
            if (parsedValues.length === 0) {
                setError('Ingresá al menos un talle válido.');
                return;
            }
            payload.values = parsedValues;
        }

        try {
            if (editingId) {
                await api.updateAdminCatalog(selectedCatalog, editingId, payload);
            } else {
                await api.createAdminCatalog(selectedCatalog, payload);
            }
            resetForm();
            await loadItems(selectedCatalog);
        } catch (err) {
            const message = formatCatalogError(err, 'No pudimos guardar los datos');
            setError(message);
        }
    };

    const handleDelete = async (id: string) => {
        setError(null);
        try {
            await api.deleteAdminCatalog(selectedCatalog, id);
            if (editingId === id) resetForm();
            await loadItems(selectedCatalog);
        } catch (err) {
            const message = formatCatalogError(err, 'No pudimos eliminar el registro');
            setError(message);
        }
    };

    const handleAttributesSaved = async () => {
        await loadItems(selectedCatalog);
    };

    return (
        <section>
            <header className={styles.hero}>
                <button type="button" className={styles.backButton} onClick={() => navigate('/')}><ArrowLeft size={18} /></button>
                <h1>Catálogos</h1>
                <p>Administración de datos maestros</p>
                <button type="button" className={styles.secondaryButton} onClick={() => setAttributesModalOpen(true)}>
                    Atributos
                </button>
            </header>

            <div className={styles.content}>
                <h2 className={styles.sectionTitle}>Seleccioná el catálogo</h2>
                <div className={styles.catalogGrid}>
                    {catalogOptions.map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            onClick={() => setSelectedCatalog(option.key)}
                            className={selectedCatalog === option.key ? styles.catalogCardActive : styles.catalogCard}
                        >
                            <span>{option.emoji}</span>
                            <span>{option.label}</span>
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className={styles.formCard}>
                    <input className={styles.input} placeholder="Código" value={code} onChange={(e) => setCode(e.target.value)} required />
                    <input className={styles.input} placeholder={isSupplier ? 'Nombre' : 'Descripción'} value={description} onChange={(e) => setDescription(e.target.value)} required />
                    {requiresLogo && (
                        <>
                            <FileUploadField
                                label="Logo del catálogo"
                                buttonText="Elegir archivo"
                                selectedFileName={selectedLogoFileName}
                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                onFileSelect={(file) => void handleLogoUpload(file)}
                                disabled={uploadingLogo}
                                helperText="Formatos: PNG, JPG, WEBP o SVG"
                            />
                            {uploadingLogo && <p className={styles.mutedText}>Subiendo logo...</p>}
                            {logoUrl && (
                                <div className={styles.logoPreviewBlock}>
                                    <p className={styles.logoPreviewLabel}>Logo actual</p>
                                    <img
                                        src={api.resolveAssetUrl(logoUrl)}
                                        alt={description ? `Logo de ${description}` : 'Logo del proveedor'}
                                        className={styles.logoPreviewImage}
                                    />
                                </div>
                            )}
                        </>
                    )}
                    {isCategory && <input className={styles.input} placeholder="Descripción larga" value={longDescription} onChange={(e) => setLongDescription(e.target.value)} />}
                    {isSizeCurve && <input className={styles.input} placeholder="Valores de talle separados por coma" value={sizeValues} onChange={(e) => setSizeValues(e.target.value)} required />}

                    <button type="submit" className={styles.primaryButton}><Plus size={16} /> {editingId ? `Actualizar ${title}` : `Agregar ${title}`}</button>
                </form>
                {error && <p className={styles.errorText}>{error}</p>}

                <h2 className={styles.sectionTitle}>{title} registrados</h2>
                {loading ? <p className={styles.mutedText}>Cargando...</p> : (
                    <div className={styles.itemsList}>
                        {items.map((item) => (
                            <article key={item.id} className={styles.itemCard}>
                                <div className={styles.itemMain}>
                                    {isSupplier && item.logoUrl ? (
                                        <img
                                            src={api.resolveAssetUrl(item.logoUrl)}
                                            alt={getDisplayDescription(item) ? `Logo de ${getDisplayDescription(item)}` : 'Logo de proveedor'}
                                            className={styles.itemLogo}
                                        />
                                    ) : (
                                        <span className={styles.itemCode}>{item.code}</span>
                                    )}
                                    <div>
                                        <p className={styles.itemTitle}>{getDisplayDescription(item)}</p>
                                        {item.values && item.values.length > 0 && <p className={styles.itemMeta}>{item.values.map((size) => size.value).join('-')}</p>}
                                    </div>
                                </div>
                                <div className={styles.actions}>
                                    <button type="button" className={styles.iconButton} onClick={() => handleEdit(item)}><Pencil size={14} /></button>
                                    <button type="button" className={styles.iconButtonDanger} onClick={() => void handleDelete(item.id)}><Trash2 size={14} /></button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>

            <AttributesModal
                isOpen={attributesModalOpen}
                onClose={() => setAttributesModalOpen(false)}
                onSaved={handleAttributesSaved}
                initialCatalog={selectedCatalog === 'materials' || selectedCatalog === 'families' || selectedCatalog === 'classifications' || selectedCatalog === 'categories' || selectedCatalog === 'garment-types'
                    ? selectedCatalog
                    : 'materials'}
            />
        </section>
    );
}
