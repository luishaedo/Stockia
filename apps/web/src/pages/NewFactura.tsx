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
            setError('Invoice number is required');
            return;
        }

        try {
            const id = await createFactura(nroFactura, proveedor);
            navigate(`/facturas/${id}/wizard`);
        } catch (err) {
            // Error handled in context state usually, but valid to check here
        }
    };

    return (
        <div className="max-w-md mx-auto mt-12">
            <Card title="New Invoice" className="shadow-lg">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Input
                        label="Invoice Number *"
                        value={nroFactura}
                        onChange={(e) => setNroFactura(e.target.value)}
                        placeholder="e.g. A-0001-12345678"
                        error={error}
                    />

                    <Input
                        label="Provider (Optional)"
                        value={proveedor}
                        onChange={(e) => setProveedor(e.target.value)}
                        placeholder="e.g. Nike"
                    />

                    <div className="mt-4 flex justify-end">
                        <Button
                            type="submit"
                            isLoading={state.status === 'SAVING'}
                            icon={<ArrowRight className="h-4 w-4" />}
                        >
                            Start Loading
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
