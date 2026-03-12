import { ClipboardEvent, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { ApiError, api } from '../../services/api';
import { AdminCatalogKey } from '../../services/types';
import styles from './AttributesModal.module.css';

type CatalogOption = {
    key: AdminCatalogKey;
    label: string;
};

type CatalogItem = {
    id: string;
    code: string;
    name?: string;
    description?: string;
    values?: { value: string; sortOrder: number }[];
};

type EditableRow = {
    id?: string;
    code: string;
    description: string;
    curve: string;
    selected: boolean;
};

const SIMPLE_ATTRIBUTE_CATALOGS: CatalogOption[] = [
    { key: 'size-curves', label: 'Curva de talle' },
    { key: 'materials', label: 'Material' },
    { key: 'families', label: 'Familia' },
    { key: 'classifications', label: 'Clasificación' },
    { key: 'categories', label: 'Categoría' },
    { key: 'garment-types', label: 'Tipo de prenda' }
];

const getDescriptionValue = (item: CatalogItem) => item.description ?? item.name ?? '';

const formatError = (error: unknown, fallback: string) => {
    if (error instanceof ApiError) {
        return `${error.message} [${error.code}]`;
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
};

const getPayloadFromRow = (catalog: AdminCatalogKey, row: EditableRow) => ({
    code: row.code.trim(),
    ...(catalog === 'suppliers' ? { name: row.description.trim() } : { description: row.description.trim() }),
    ...(catalog === 'size-curves'
        ? {
            values: row.curve
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean)
        }
        : {})
});

const parsePastedRows = (rawText: string, selectedCatalog: AdminCatalogKey): EditableRow[] => {
    return rawText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const [code = '', description = '', curve = ''] = line.split('\t');
            return {
                code: code.trim(),
                description: description.trim(),
                curve: selectedCatalog === 'size-curves' ? curve.trim() : '',
                selected: false
            };
        })
        .filter((row) => row.code || row.description);
};

interface AttributesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: (catalog: AdminCatalogKey) => Promise<void> | void;
    initialCatalog?: AdminCatalogKey;
}

export function AttributesModal({ isOpen, onClose, onSaved, initialCatalog = 'materials' }: AttributesModalProps) {
    const [selectedCatalog, setSelectedCatalog] = useState<AdminCatalogKey>(initialCatalog);
    const [rows, setRows] = useState<EditableRow[]>([]);
    const [initialRowsById, setInitialRowsById] = useState<Record<string, { code: string; description: string; curve: string }>>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedCount = useMemo(() => rows.filter((row) => row.selected).length, [rows]);

    useEffect(() => {
        if (!isOpen) return;
        setSelectedCatalog(initialCatalog);
    }, [initialCatalog, isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const loadCatalog = async () => {
            setLoading(true);
            setError(null);

            try {
                const items = await api.getAdminCatalogCached<CatalogItem[]>(selectedCatalog, true);
                const mappedRows = items.map((item) => ({
                    id: item.id,
                    code: item.code,
                    description: getDescriptionValue(item),
                    curve: selectedCatalog === 'size-curves' ? (item.values ?? []).map((entry) => entry.value).join(', ') : '',
                    selected: false
                }));

                setRows(mappedRows);
                setInitialRowsById(Object.fromEntries(mappedRows.filter((row) => row.id).map((row) => [row.id as string, {
                    code: row.code,
                    description: row.description,
                    curve: row.curve
                }])));
            } catch (err) {
                setError(formatError(err, 'No pudimos cargar los atributos'));
            } finally {
                setLoading(false);
            }
        };

        void loadCatalog();
    }, [isOpen, selectedCatalog]);

    if (!isOpen) return null;

    const isSizeCurveCatalog = selectedCatalog === 'size-curves';

    const updateRow = (index: number, field: 'code' | 'description' | 'curve', value: string) => {
        setRows((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
    };

    const addRow = () => {
        setRows((prev) => [...prev, { code: '', description: '', curve: '', selected: false }]);
    };

    const toggleSelectAll = (checked: boolean) => {
        setRows((prev) => prev.map((row) => ({ ...row, selected: checked })));
    };

    const toggleRowSelection = (index: number, checked: boolean) => {
        setRows((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, selected: checked } : row));
    };

    const deleteSelected = () => {
        setRows((prev) => prev.filter((row) => !row.selected));
    };

    const deleteRow = (index: number) => {
        setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
    };

    const clearAll = () => {
        if (!window.confirm('¿Seguro que querés borrar todos los registros del atributo seleccionado?')) {
            return;
        }
        setRows([]);
    };

    const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
        const rawText = event.clipboardData.getData('text/plain');
        const parsedRows = parsePastedRows(rawText, selectedCatalog);
        if (parsedRows.length === 0) return;

        event.preventDefault();
        setRows((prev) => [...prev, ...parsedRows]);
    };

    const validateRows = () => {
        const normalizedRows = rows.map((row) => ({
            ...row,
            code: row.code.trim(),
            description: row.description.trim(),
            curve: row.curve.trim()
        }));

        if (normalizedRows.some((row) => !row.code || !row.description)) {
            return { error: 'Código y descripción son obligatorios en todas las filas.', normalizedRows };
        }

        const codeSet = new Set<string>();
        for (const row of normalizedRows) {
            const key = row.code.toLowerCase();
            if (codeSet.has(key)) {
                return { error: `Código duplicado detectado: ${row.code}`, normalizedRows };
            }
            codeSet.add(key);
        }

        if (isSizeCurveCatalog && normalizedRows.some((row) => row.curve.split(',').map((value) => value.trim()).filter(Boolean).length === 0)) {
            return { error: 'La columna curva es obligatoria y debe tener valores separados por coma.', normalizedRows };
        }

        return { error: null, normalizedRows };
    };

    const saveChanges = async () => {
        setSaving(true);
        setError(null);

        const { error: validationError, normalizedRows } = validateRows();
        if (validationError) {
            setError(validationError);
            setSaving(false);
            return;
        }

        try {
            const currentRowsWithId = normalizedRows.filter((row) => row.id);
            const currentIds = new Set(currentRowsWithId.map((row) => row.id as string));
            const deletedIds = Object.keys(initialRowsById).filter((id) => !currentIds.has(id));

            for (const id of deletedIds) {
                await api.deleteAdminCatalog(selectedCatalog, id);
            }

            for (const row of currentRowsWithId) {
                const source = initialRowsById[row.id as string];
                if (!source) continue;

                const changed = source.code !== row.code || source.description !== row.description || source.curve !== row.curve;
                if (changed) {
                    await api.updateAdminCatalog(selectedCatalog, row.id as string, getPayloadFromRow(selectedCatalog, row));
                }
            }

            for (const row of normalizedRows.filter((entry) => !entry.id)) {
                await api.createAdminCatalog(selectedCatalog, getPayloadFromRow(selectedCatalog, row));
            }

            await onSaved(selectedCatalog);
            onClose();
        } catch (err) {
            setError(formatError(err, 'No pudimos guardar cambios del atributo'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.overlay} role="presentation" onClick={onClose}>
            <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="attributes-modal-title" onClick={(event) => event.stopPropagation()}>
                <div className={styles.header}>
                    <div>
                        <h2 id="attributes-modal-title">Gestión de Atributos</h2>
                        <p>Edición rápida y masiva de catálogos simples.</p>
                    </div>
                    <button type="button" className={styles.iconButton} onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>

                <div className={styles.toolbar}>
                    <label className={styles.selectorWrap}>
                        <span>Atributo</span>
                        <select value={selectedCatalog} onChange={(event) => setSelectedCatalog(event.target.value as AdminCatalogKey)}>
                            {SIMPLE_ATTRIBUTE_CATALOGS.map((option) => (
                                <option key={option.key} value={option.key}>{option.label}</option>
                            ))}
                        </select>
                    </label>

                    <div className={styles.actions}>
                        <button type="button" className={styles.secondaryButton} onClick={addRow}><Plus size={14} /> Agregar fila</button>
                        <button type="button" className={styles.secondaryButton} onClick={deleteSelected} disabled={selectedCount === 0}><Trash2 size={14} /> Eliminar seleccionados</button>
                        <button type="button" className={styles.dangerButton} onClick={clearAll} disabled={rows.length === 0}>Borrar todo</button>
                        <button type="button" className={styles.primaryButton} onClick={saveChanges} disabled={saving || loading}><Save size={14} /> {saving ? 'Guardando...' : 'Guardar cambios'}</button>
                    </div>
                </div>

                <textarea
                    className={styles.pasteArea}
                    placeholder={isSizeCurveCatalog
                        ? 'Pegá aquí desde Excel (Ctrl + V): código[TAB]descripción[TAB]curva (valores separados por coma)'
                        : 'Pegá aquí desde Excel (Ctrl + V): código[TAB]descripción'}
                    onPaste={handlePaste}
                    readOnly
                />

                {error && <p className={styles.error}>{error}</p>}

                <div className={styles.tableWrapper}>
                    {loading ? <p className={styles.loading}>Cargando...</p> : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th><input type="checkbox" checked={rows.length > 0 && selectedCount === rows.length} onChange={(event) => toggleSelectAll(event.target.checked)} /></th>
                                    <th>Código</th>
                                    <th>Descripción</th>
                                    {isSizeCurveCatalog && <th>Curva</th>}
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, index) => (
                                    <tr key={`${row.id ?? 'new'}-${index}`}>
                                        <td>
                                            <input type="checkbox" checked={row.selected} onChange={(event) => toggleRowSelection(index, event.target.checked)} />
                                        </td>
                                        <td>
                                            <input
                                                value={row.code}
                                                onChange={(event) => updateRow(index, 'code', event.target.value)}
                                                className={styles.cellInput}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                value={row.description}
                                                onChange={(event) => updateRow(index, 'description', event.target.value)}
                                                className={styles.cellInput}
                                            />
                                        </td>
                                        {isSizeCurveCatalog && (
                                            <td>
                                                <input
                                                    value={row.curve}
                                                    onChange={(event) => updateRow(index, 'curve', event.target.value)}
                                                    className={styles.cellInput}
                                                    placeholder="XS,S,M,L"
                                                />
                                            </td>
                                        )}
                                        <td>
                                            <button type="button" className={styles.rowDeleteButton} onClick={() => deleteRow(index)}>
                                                Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={isSizeCurveCatalog ? 5 : 4} className={styles.empty}>No hay filas. Agregá una o pegá datos desde Excel.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
