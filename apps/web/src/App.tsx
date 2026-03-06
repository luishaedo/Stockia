import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { FacturaProvider } from './context/FacturaContext';
import { AuthProvider } from './context/AuthContext';
import { MainLayout } from './components/layout/MainLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { NewFactura } from './pages/NewFactura';
import { FacturaWizard } from './pages/FacturaWizard';
import { FacturaSummary } from './pages/FacturaSummary';
import { FacturasListPage } from './pages/FacturasListPage';
import { LoginPage } from './pages/LoginPage';
import { AdminCatalogPage } from './pages/AdminCatalogPage';
import { AdminInvoicesPage } from './pages/AdminInvoicesPage';
import { ArticlesPage } from './pages/ArticlesPage';
import { SearchFacturasPage } from './pages/SearchFacturasPage';
import './index.css';

function App() {
    return (
        <AuthProvider>
            <FacturaProvider>
                <Router>
                    <MainLayout>
                        <Routes>
                            <Route path="/login" element={<LoginPage />} />
                            <Route
                                path="/"
                                element={<FacturasListPage />}
                            />
                            <Route
                                path="/facturas"
                                element={<Navigate to="/" replace />}
                            />
                            <Route
                                path="/admin/facturas"
                                element={(
                                    <ProtectedRoute>
                                        <AdminInvoicesPage />
                                    </ProtectedRoute>
                                )}
                            />
                            <Route
                                path="/admin"
                                element={(
                                    <ProtectedRoute>
                                        <AdminCatalogPage />
                                    </ProtectedRoute>
                                )}
                            />
                            <Route
                                path="/facturas/new"
                                element={<NewFactura />}
                            />
                            <Route
                                path="/facturas/:id/wizard"
                                element={<FacturaWizard />}
                            />
                            <Route
                                path="/facturas/:id/summary"
                                element={<FacturaSummary />}
                            />
                            <Route path="/articulos" element={<ArticlesPage />} />
                            <Route path="/buscar" element={<SearchFacturasPage />} />
                        </Routes>
                    </MainLayout>
                </Router>
            </FacturaProvider>
        </AuthProvider>
    );
}

export default App;
