import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFactura } from '../context/FacturaContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { ApiError, api } from '../services/api';

export function NewFactura() {
    const navigate = useNavigate();
    const { createFactura, state } = useFactura();

    const [nroFactura, setNroFactura] = useState('');
    const [proveedor, setProveedor] = useState('');
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

        if (!proveedor.trim()) {
            setError('Seleccioná un proveedor existente para continuar.');
            return;
        }

        try {
            const id = await createFactura(nroFactura, proveedor);
            navigate(`/facturas/${id}/wizard`);
        } catch {
            // handled by context
        }
    };

    return (
        <div className="max-w-md mx-auto mt-6 sm:mt-12 px-1 sm:px-0">
            <Card title="Nueva factura" className="shadow-lg">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Input
                        label="Nro. factura *"
                        value={nroFactura}
                        onChange={(e) => setNroFactura(e.target.value)}
                        placeholder="Ej: A-0001-12345678"
                        error={error}
                    />

                    <Input
                        label="Proveedor *"
                        value={proveedor}
                        onChange={(e) => setProveedor(e.target.value)}
                        placeholder={loadingSuppliers ? 'Cargando proveedores...' : 'Seleccioná un proveedor'}
                        list="supplier-options"
                        disabled={loadingSuppliers || suppliers.length === 0}
                    />
                    <datalist id="supplier-options">
                        {suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.label}>{supplier.label}</option>
                        ))}
                    </datalist>

                    {(suppliersError || suppliers.length === 0) && !loadingSuppliers && (
                        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 mt-0.5" />
                                <div>
                                    <p>{suppliersError || 'No hay proveedores cargados. Debés crear uno antes de generar facturas.'}</p>
                                    <Link to="/admin" className="underline text-amber-200 hover:text-amber-100">Ir a Administración de catálogos</Link>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-2">
                        <Button
                            type="submit"
                            isLoading={state.status === 'SAVING'}
                            icon={<ArrowRight className="h-4 w-4" />}
                            className="w-full sm:w-auto"
                            disabled={loadingSuppliers || suppliers.length === 0}
                        >
                            Comenzar carga
                        </Button>
                    </div>

                    {state.error && (
                        <div className="text-red-500 text-sm mt-2 p-2 bg-red-500/10 rounded">
                            {state.error}
                        </div>
                    )}
                </form>
            </Card>
        </div>
    );
}
