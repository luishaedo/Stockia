import { FormEvent, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ApiError, api } from '../../services/api';
import styles from './SupplierCreateModal.module.css';

type CreatedSupplier = {
    id: string;
    code: string;
    name: string;
    logoUrl?: string | null;
};

interface SupplierCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (supplier: CreatedSupplier) => void;
}

export function SupplierCreateModal({ isOpen, onClose, onCreated }: SupplierCreateModalProps) {
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setCode('');
            setName('');
            setError(null);
            setSaving(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!code.trim() || !name.trim()) {
            setError('Código y nombre son obligatorios.');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const created = await api.createSupplier({ code: code.trim(), name: name.trim() });
            onCreated(created);
            onClose();
        } catch (err) {
            if (err instanceof ApiError) {
                setError(`${err.message} [${err.code}]`);
            } else if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('No pudimos crear el proveedor.');
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.overlay} role="presentation" onClick={onClose}>
            <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="create-supplier-title" onClick={(event) => event.stopPropagation()}>
                <div className={styles.header}>
                    <div>
                        <h2 id="create-supplier-title">Crear proveedor</h2>
                        <p>Crealo en contexto y dejalo seleccionado para esta factura.</p>
                    </div>
                    <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Cerrar modal">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <label>
                        <span>Código</span>
                        <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Ej: NIKE" disabled={saving} />
                    </label>

                    <label>
                        <span>Nombre</span>
                        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej: Nike" disabled={saving} />
                    </label>

                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.actions}>
                        <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={saving}>Cancelar</button>
                        <button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? 'Guardando...' : 'Crear proveedor'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
