import { useEffect, useState } from 'react';
import { AlertTriangle, Save, X } from 'lucide-react';
import { ApiError, api } from '../../services/api';
import { MissingDragonfishEquivalence } from '../../services/dragonfishApi';
import styles from './MissingDragonfishEquivalencesModal.module.css';

export function MissingDragonfishEquivalencesModal({ missing, onClose, onRetry }: {
    missing: MissingDragonfishEquivalence[];
    onClose: () => void;
    onRetry: () => Promise<void>;
}) {
    const [pending, setPending] = useState(missing);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        setPending(missing);
        setDrafts({});
    }, [missing]);

    const save = async (item: MissingDragonfishEquivalence) => {
        const key = `${item.articleId || ''}|${item.colorCode}`;
        const dragonfishCode = drafts[key]?.trim();
        if (!item.articleId || !dragonfishCode) return;
        setSavingKey(key);
        setError('');
        try {
            await api.createDragonfishEquivalence({
                articleId: item.articleId,
                colorCode: item.colorCode,
                dragonfishCode
            });
            setPending((current) => current.filter((entry) => `${entry.articleId || ''}|${entry.colorCode}` !== key));
        } catch (reason) {
            setError(reason instanceof ApiError ? reason.message : 'No pudimos guardar la equivalencia');
        } finally {
            setSavingKey(null);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                <header className={styles.header}>
                    <div className={styles.title}>
                        <AlertTriangle size={21} />
                        <div>
                            <h2>Faltan equivalencias Dragonfish</h2>
                            <p>Primero creá el artículo en Dragonfish y luego cargá su código.</p>
                        </div>
                    </div>
                    <button type="button" className={styles.iconButton} onClick={onClose} title="Cerrar"><X size={18} /></button>
                </header>

                {error && <p className={styles.error}>{error}</p>}
                <div className={styles.list}>
                    {pending.map((item) => {
                        const key = `${item.articleId || ''}|${item.colorCode}`;
                        return (
                            <div className={styles.item} key={key}>
                                <div className={styles.details}>
                                    <strong>{item.supplierCode} · {item.articleSku}</strong>
                                    <span>{item.articleDescription}</span>
                                    <span>Color: {item.colorCode === '$' ? 'SIN COLOR' : `${item.colorCode} - ${item.colorDescription}`}</span>
                                </div>
                                {item.articleId ? (
                                    <div className={styles.saveRow}>
                                        <input
                                            value={drafts[key] || ''}
                                            onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value.toUpperCase() }))}
                                            placeholder="Código Dragonfish"
                                        />
                                        <button type="button" onClick={() => void save(item)} disabled={savingKey === key || !drafts[key]?.trim()} title="Guardar">
                                            <Save size={17} />
                                            <span>Guardar</span>
                                        </button>
                                    </div>
                                ) : (
                                    <p className={styles.articleWarning}>Este ítem primero debe vincularse con un artículo maestro de Stockia.</p>
                                )}
                            </div>
                        );
                    })}
                </div>

                {pending.length === 0 && <p className={styles.ready}>Todas las equivalencias fueron cargadas. Ya podés generar el TXT.</p>}
                <footer className={styles.actions}>
                    <button type="button" className={styles.secondaryButton} onClick={onClose}>Cerrar</button>
                    <button type="button" className={styles.primaryButton} onClick={() => void onRetry()} disabled={pending.length > 0}>
                        Generar TXT
                    </button>
                </footer>
            </div>
        </div>
    );
}
