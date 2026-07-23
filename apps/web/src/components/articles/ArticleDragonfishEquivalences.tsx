import { useEffect, useState } from 'react';
import { Check, Link2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api, ApiError, SupplierColorRecord } from '../../services/api';
import { ArticleResponse } from '../../services/articlesApi';
import { DragonfishEquivalenceRow } from '../../services/dragonfishApi';
import styles from './ArticleDragonfishEquivalences.module.css';

export function ArticleDragonfishEquivalences({ article }: { article: ArticleResponse }) {
    const [items, setItems] = useState<DragonfishEquivalenceRow[]>([]);
    const [colors, setColors] = useState<SupplierColorRecord[]>([]);
    const [colorCode, setColorCode] = useState('$');
    const [dragonfishCode, setDragonfishCode] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingCode, setEditingCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const [equivalences, supplierColors] = await Promise.all([
                api.listDragonfishEquivalences({ articleId: article.id, status: 'mapped', pageSize: 200 }),
                api.getSupplierColors(article.supplierId)
            ]);
            setItems(equivalences.items);
            setColors(supplierColors);
        } catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof ApiError ? error.message : 'No pudimos cargar las equivalencias'
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, [article.id]);

    const onCreate = async () => {
        if (!dragonfishCode.trim()) return;
        setSaving(true);
        setMessage(null);
        try {
            await api.createDragonfishEquivalence({ articleId: article.id, colorCode, dragonfishCode });
            setDragonfishCode('');
            setMessage({ type: 'success', text: 'Equivalencia guardada.' });
            await load();
        } catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof ApiError ? error.message : 'No pudimos guardar la equivalencia'
            });
        } finally {
            setSaving(false);
        }
    };

    const onUpdate = async (id: string) => {
        if (!editingCode.trim()) return;
        setSaving(true);
        try {
            await api.updateDragonfishEquivalence(id, editingCode);
            setEditingId(null);
            await load();
        } catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof ApiError ? error.message : 'No pudimos actualizar la equivalencia'
            });
        } finally {
            setSaving(false);
        }
    };

    const onDelete = async (id: string) => {
        if (!window.confirm('¿Eliminar esta equivalencia Dragonfish?')) return;
        setSaving(true);
        try {
            await api.deleteDragonfishEquivalence(id);
            await load();
        } catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof ApiError ? error.message : 'No pudimos eliminar la equivalencia'
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className={styles.section}>
            <div className={styles.heading}>
                <Link2 size={18} />
                <div>
                    <h3>Equivalencias Dragonfish</h3>
                    <p>Primero creá el artículo en Dragonfish y luego cargá su código.</p>
                </div>
            </div>

            <div className={styles.createRow}>
                <select value={colorCode} onChange={(event) => setColorCode(event.target.value)} disabled={saving}>
                    <option value="$">SIN COLOR</option>
                    {colors.map((color) => (
                        <option key={color.id} value={color.code}>{color.code} - {color.value}</option>
                    ))}
                </select>
                <input
                    value={dragonfishCode}
                    onChange={(event) => setDragonfishCode(event.target.value.toUpperCase())}
                    placeholder="Código Dragonfish"
                    disabled={saving}
                />
                <button type="button" onClick={() => void onCreate()} disabled={saving || !dragonfishCode.trim()} title="Agregar equivalencia">
                    <Plus size={18} />
                    <span>Agregar</span>
                </button>
            </div>

            {message && <p className={message.type === 'error' ? styles.error : styles.success}>{message.text}</p>}
            {loading && <p className={styles.muted}>Cargando equivalencias...</p>}
            {!loading && items.length === 0 && <p className={styles.muted}>Este artículo todavía no tiene equivalencias.</p>}

            <div className={styles.list}>
                {items.map((item) => (
                    <div className={styles.item} key={item.id || `${item.articleId}-${item.colorCode}`}>
                        <div>
                            <strong>{item.colorCode === '$' ? 'SIN COLOR' : `${item.colorCode} - ${item.colorDescription}`}</strong>
                            {editingId !== item.id && <span>{item.dragonfishCode}</span>}
                        </div>
                        {editingId === item.id ? (
                            <div className={styles.editActions}>
                                <input value={editingCode} onChange={(event) => setEditingCode(event.target.value.toUpperCase())} />
                                <button type="button" onClick={() => item.id && void onUpdate(item.id)} title="Guardar"><Check size={16} /></button>
                                <button type="button" onClick={() => setEditingId(null)} title="Cancelar"><X size={16} /></button>
                            </div>
                        ) : (
                            <div className={styles.actions}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingId(item.id);
                                        setEditingCode(item.dragonfishCode || '');
                                    }}
                                    title="Editar"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button type="button" onClick={() => item.id && void onDelete(item.id)} title="Eliminar">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
