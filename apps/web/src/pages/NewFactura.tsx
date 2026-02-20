import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFactura } from '../context/FacturaContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ArrowRight } from 'lucide-react';

export function NewFactura() {
    const navigate = useNavigate();
    const { createFactura, state } = useFactura();

    const [nroFactura, setNroFactura] = useState('');
    const [proveedor, setProveedor] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nroFactura.trim()) {
            setError('El número de factura es obligatorio.');
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
                        label="Proveedor (opcional)"
                        value={proveedor}
                        onChange={(e) => setProveedor(e.target.value)}
                        placeholder="Ej: Nike"
                    />

                    <div className="mt-2">
                        <Button
                            type="submit"
                            isLoading={state.status === 'SAVING'}
                            icon={<ArrowRight className="h-4 w-4" />}
                            className="w-full sm:w-auto"
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
