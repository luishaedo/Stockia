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

    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [longDescription, setLongDescription] = useState('');
    const [sizeValues, setSizeValues] = useState('');

    const isSupplier = selectedCatalog === 'suppliers';
    const isCategory = selectedCatalog === 'categories';
    const isSizeCurve = selectedCatalog === 'size-curves';

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
            const data = await api.getAdminCatalog<CatalogItem[]>(catalog);
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
    }, [selectedCatalog]);

    const handleEdit = (item: CatalogItem) => {
        setEditingId(item.id);
        setCode(item.code);
        setDescription(item.name || item.description || '');
        setLogoUrl(item.logoUrl || '');
        setLongDescription(item.longDescription || '');
        setSizeValues(item.values?.map(entry => entry.value).join(',') || '');
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

                    {(isSupplier || isCategory) && (
                        <Input label="Logo URL" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} />
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
                                    {item.logoUrl && <p className="text-xs text-slate-400">Logo: {item.logoUrl}</p>}
                                    {item.longDescription && <p className="text-xs text-slate-400">{item.longDescription}</p>}
                                    {item.values && item.values.length > 0 && (
                                        <p className="text-xs text-slate-400">Talles: {item.values.map(size => size.value).join(', ')}</p>
                                    )}
                                </div>
                                <Button size="sm" variant="secondary" onClick={() => handleEdit(item)}>Editar</Button>
                            </div>
                        ))}
                        {!items.length && <p className="text-slate-400">No hay registros cargados.</p>}
                    </div>
                )}
            </Card>
        </div>
    );
}
