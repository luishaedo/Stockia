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
                                element={(
                                    <ProtectedRoute>
                                        <Navigate to="/facturas" replace />
                                    </ProtectedRoute>
                                )}
                            />
                            <Route
                                path="/facturas"
                                element={(
                                    <ProtectedRoute>
                                        <FacturasListPage />
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
                                element={(
                                    <ProtectedRoute>
                                        <NewFactura />
                                    </ProtectedRoute>
                                )}
                            />
                            <Route
                                path="/facturas/:id/wizard"
                                element={(
                                    <ProtectedRoute>
                                        <FacturaWizard />
                                    </ProtectedRoute>
                                )}
                            />
                            <Route
                                path="/facturas/:id/summary"
                                element={(
                                    <ProtectedRoute>
                                        <FacturaSummary />
                                    </ProtectedRoute>
                                )}
                            />
                        </Routes>
                    </MainLayout>
                </Router>
            </FacturaProvider>
        </AuthProvider>
    );
}

export default App;
