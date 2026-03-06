import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useFactura } from '../context/FacturaContext';
import { ApiError, api } from '../services/api';
import styles from './NewFactura.module.css';

export function NewFactura() {
    const navigate = useNavigate();
    const { createFactura, state } = useFactura();

    const [nroFactura, setNroFactura] = useState('');
    const [supplierId, setSupplierId] = useState('');
    const [error, setError] = useState('');
    const [suppliers, setSuppliers] = useState<Array<{ id: string; label: string }>>([]);
    const [suppliersError, setSuppliersError] = useState<string | null>(null);
    const [loadingSuppliers, setLoadingSuppliers] = useState(false);

    useEffect(() => {
        const loadSuppliers = async () => {
            setLoadingSuppliers(true);
            setSuppliersError(null);

            try {
                const response = await api.getOperationsCatalogs(true);
                setSuppliers(response.suppliers);
            } catch (err) {
                const message = err instanceof ApiError
                    ? err.message
                    : 'No pudimos cargar proveedores para crear facturas.';
                setSuppliersError(message);
            } finally {
                setLoadingSuppliers(false);
            }
        };

        void loadSuppliers();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nroFactura.trim()) {
            setError('El número de factura es obligatorio.');
            return;
        }

        if (!supplierId.trim()) {
            setError('Seleccioná un proveedor existente para continuar.');
            return;
        }

        try {
            const id = await createFactura(nroFactura, supplierId);
            navigate(`/facturas/${id}/wizard`);
        } catch {
            // handled by context
        }
    };

    return (
        <section>
            <header className={styles.hero}>
                <button type="button" className={styles.backButton} onClick={() => navigate(-1)}>
                    <ArrowLeft size={18} />
                </button>
                <h1>Nueva factura</h1>
                <p>Ingresá los datos básicos para comenzar</p>
            </header>

            <form onSubmit={handleSubmit} className={styles.formCard}>
                <div>
                    <label className={styles.label}>Nro. factura *</label>
                    <input
                        className={styles.input}
                        value={nroFactura}
                        onChange={(e) => setNroFactura(e.target.value)}
                        placeholder="Ej: A-0001-12345678"
                    />
                </div>

                <div>
                    <label className={styles.label}>Proveedor *</label>
                    <div className={styles.suppliersGrid}>
                        {suppliers.map((supplier) => {
                            const active = supplierId === supplier.id;
                            return (
                                <button
                                    key={supplier.id}
                                    type="button"
                                    onClick={() => setSupplierId(supplier.id)}
                                    className={active ? styles.supplierCardActive : styles.supplierCard}
                                    disabled={loadingSuppliers}
                                >
                                    {active && <CheckCircle2 size={18} className={styles.checkIcon} />}
                                    <span className={styles.supplierAvatar}>{supplier.label.charAt(0)}</span>
                                    <span className={styles.supplierName}>{supplier.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {(suppliersError || suppliers.length === 0) && !loadingSuppliers && (
                    <div className={styles.warning}>
                        <AlertCircle size={16} />
                        <div>
                            <p>{suppliersError || 'No hay proveedores cargados. Debés crear uno antes de generar facturas.'}</p>
                            <Link to="/admin">Ir a Administración de catálogos</Link>
                        </div>
                    </div>
                )}

                <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={state.isSaving || loadingSuppliers || suppliers.length === 0}
                >
                    {state.isSaving ? 'Creando...' : 'Comenzar carga'} <ArrowRight size={16} />
                </button>

                {(error || state.error) && <p className={styles.errorText}>{error || state.error}</p>}
            </form>
        </section>
    );
}
