import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../services/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';

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

const catalogOptions: Array<{ key: CatalogKey; label: string }> = [
    { key: 'suppliers', label: 'Proveedores' },
    { key: 'size-curves', label: 'Curvas de talles' },
    { key: 'families', label: 'Familias' },
    { key: 'categories', label: 'Categorías' },
    { key: 'garment-types', label: 'Tipos de prenda' },
    { key: 'materials', label: 'Materiales' },
    { key: 'classifications', label: 'Clasificaciones' }
];

const getDisplayDescription = (item: CatalogItem) => item.name || item.description || '';

export function AdminCatalogPage() {
    const [selectedCatalog, setSelectedCatalog] = useState<CatalogKey>('suppliers');
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);

    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [longDescription, setLongDescription] = useState('');
    const [sizeValues, setSizeValues] = useState('');

    const isSupplier = selectedCatalog === 'suppliers';
    const isCategory = selectedCatalog === 'categories';
    const isSizeCurve = selectedCatalog === 'size-curves';
    const requiresLogo = isCategory || isSupplier;

    const title = useMemo(() => catalogOptions.find(option => option.key === selectedCatalog)?.label ?? selectedCatalog, [selectedCatalog]);

    const resetForm = () => {
        setEditingId(null);
        setCode('');
        setDescription('');
        setLogoUrl('');
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
            const message = err instanceof ApiError ? err.message : 'No pudimos cargar el catálogo';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        resetForm();
        void loadItems(selectedCatalog);

        const nextCatalogs = catalogOptions
            .map(option => option.key)
            .filter(catalog => catalog !== selectedCatalog);
        void api.preloadAdminCatalogsIncremental(nextCatalogs);
    }, [selectedCatalog]);

    const handleEdit = (item: CatalogItem) => {
        setEditingId(item.id);
        setCode(item.code);
        setDescription(item.name || item.description || '');
        setLogoUrl(item.logoUrl || '');
        setLongDescription(item.longDescription || '');
        setSizeValues(item.values?.map(entry => entry.value).join(',') || '');
    };

    const handleLogoUpload = async (file?: File) => {
        if (!file) return;
        setUploadingLogo(true);
        setError(null);

        try {
            const response = await api.uploadAdminLogo(file);
            setLogoUrl(response.url);
        } catch (err) {
            const message = err instanceof ApiError ? err.message : 'No pudimos subir el logo';
            setError(message);
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        const payload: Record<string, unknown> = {
            code,
            ...(isSupplier ? { name: description } : { description })
        };

        if (isCategory || isSupplier) payload.logoUrl = logoUrl;
        if (isCategory) payload.longDescription = longDescription;
        if (isSizeCurve) payload.values = sizeValues.split(',').map(value => value.trim()).filter(Boolean);

        try {
            if (editingId) {
                await api.updateAdminCatalog(selectedCatalog, editingId, payload);
            } else {
                await api.createAdminCatalog(selectedCatalog, payload);
            }
            resetForm();
            await loadItems(selectedCatalog);
        } catch (err) {
            const message = err instanceof ApiError ? err.message : 'No pudimos guardar los datos';
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
            const message = err instanceof ApiError ? err.message : 'No pudimos eliminar el registro';
            setError(message);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <h1 className="text-2xl font-bold mb-2">Administración de catálogos</h1>
                <p className="text-slate-300">Alta y edición de catálogos maestros para evitar carga manual en el stockeador.</p>
            </Card>

            <Card>
                <label className="block text-sm font-medium mb-2">Catálogo</label>
                <select
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
                    value={selectedCatalog}
                    onChange={(event) => setSelectedCatalog(event.target.value as CatalogKey)}
                >
                    {catalogOptions.map(option => (
                        <option key={option.key} value={option.key}>{option.label}</option>
                    ))}
                </select>
            </Card>

            <Card>
                <h2 className="text-xl font-semibold mb-4">{editingId ? `Editar en ${title}` : `Nuevo en ${title}`}</h2>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <Input label="Código" value={code} onChange={e => setCode(e.target.value)} required />
                    <Input label={isSupplier ? 'Nombre' : 'Descripción'} value={description} onChange={e => setDescription(e.target.value)} required />

                    {requiresLogo && (
                        <div className="space-y-2">
                            <label className="block text-sm font-medium">Logo (upload)</label>
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                onChange={(event) => void handleLogoUpload(event.target.files?.[0])}
                                className="block w-full text-sm text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-slate-800 file:text-slate-100"
                            />
                            {uploadingLogo && <p className="text-xs text-slate-400">Subiendo logo...</p>}
                            {!!logoUrl && (
                                <div className="text-xs text-slate-300">
                                    <p className="mb-2">Logo cargado:</p>
                                    <img src={api.resolveAssetUrl(logoUrl)} alt="Uploaded logo" className="h-12 w-12 object-contain bg-slate-950 border border-slate-700 rounded" />
                                </div>
                            )}
                        </div>
                    )}

                    {isCategory && (
                        <Input label="Descripción larga" value={longDescription} onChange={e => setLongDescription(e.target.value)} />
                    )}

                    {isSizeCurve && (
                        <Input label="Valores de talle (separados por coma)" value={sizeValues} onChange={e => setSizeValues(e.target.value)} required />
                    )}

                    <div className="flex gap-2">
                        <Button type="submit">{editingId ? 'Actualizar' : 'Crear'}</Button>
                        {editingId && <Button type="button" variant="secondary" onClick={resetForm}>Cancelar edición</Button>}
                    </div>
                </form>
                {error && <p className="text-red-400 mt-3">{error}</p>}
            </Card>

            <Card>
                <h2 className="text-xl font-semibold mb-4">Registros de {title}</h2>
                {loading ? <p>Cargando...</p> : (
                    <div className="space-y-2">
                        {items.map(item => (
                            <div key={item.id} className="border border-slate-700 rounded-md p-3 flex justify-between items-center gap-3">
                                <div>
                                    <p className="font-semibold">{item.code} - {getDisplayDescription(item)}</p>
                                    {item.logoUrl && (
                                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                                            <img src={api.resolveAssetUrl(item.logoUrl)} alt={`Logo for ${getDisplayDescription(item)}`} className="h-8 w-8 object-contain bg-slate-950 border border-slate-700 rounded" />
                                            <span>{item.logoUrl}</span>
                                        </div>
                                    )}
                                    {item.longDescription && <p className="text-xs text-slate-400">{item.longDescription}</p>}
                                    {item.values && item.values.length > 0 && (
                                        <p className="text-xs text-slate-400">Talles: {item.values.map(size => size.value).join(', ')}</p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="secondary" onClick={() => handleEdit(item)}>Editar</Button>
                                    <Button size="sm" variant="ghost" onClick={() => void handleDelete(item.id)}>Eliminar</Button>
                                </div>
                            </div>
                        ))}
                        {!items.length && <p className="text-amber-300">No hay registros cargados. Debés crear al menos uno para habilitar el stockeador.</p>}
                    </div>
                )}
            </Card>
        </div>
    );
}
