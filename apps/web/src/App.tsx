import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { FacturaProvider } from './context/FacturaContext';
import { MainLayout } from './components/layout/MainLayout';
import { NewFactura } from './pages/NewFactura';
import { FacturaWizard } from './pages/FacturaWizard';
import { FacturaSummary } from './pages/FacturaSummary';
import { FacturasListPage } from './pages/FacturasListPage';
import './index.css';

function App() {
    return (
        <FacturaProvider>
            <Router>
                <MainLayout>
                    <Routes>
                        <Route path="/" element={<Navigate to="/facturas" replace />} />
                        <Route path="/facturas" element={<FacturasListPage />} />
                        <Route path="/facturas/new" element={<NewFactura />} />
                        <Route path="/facturas/:id/wizard" element={<FacturaWizard />} />
                        <Route path="/facturas/:id/summary" element={<FacturaSummary />} />
                    </Routes>
                </MainLayout>
            </Router>
        </FacturaProvider>
    );
}

export default App;
