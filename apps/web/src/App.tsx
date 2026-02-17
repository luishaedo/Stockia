import { Factura } from '@stockia/shared';
import { useState, useEffect } from 'react';

function App() {
    const [facturas, setFacturas] = useState<Factura[]>([]);

    useEffect(() => {
        setFacturas([]); // Dummy usage to satisfy lint
    }, []);

    return (
        <div>
            <h1>Stockia Invoice App</h1>
            <p>This is the initial scaffold for Phase 1.</p>
            <pre>{JSON.stringify(facturas, null, 2)}</pre>
        </div>
    )
}

export default App
