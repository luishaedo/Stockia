import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, Grid2x2, Home, KeyRound, LogOut, Plus, Shirt } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';
import styles from './MainLayout.module.css';

interface MainLayoutProps {
    children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
    const location = useLocation();
    const { isAuthenticated, logout } = useAuth();

    const isLoginPage = location.pathname === '/login';

    const isHomeRoute = location.pathname === '/' || location.pathname.startsWith('/facturas');

    return (
        <div className={styles.appFrame}>
            <div className={styles.shell}>
                {!isLoginPage && (
                    <div className={styles.authDock}>
                        {!isAuthenticated ? (
                            <Link to="/login" className={styles.authAction} aria-label="Ingresar">
                                <KeyRound size={16} />
                                <span>Ingresar</span>
                            </Link>
                        ) : (
                            <button type="button" className={styles.authAction} onClick={logout} aria-label="Cerrar sesión">
                                <LogOut size={16} />
                                <span>Salir</span>
                            </button>
                        )}
                    </div>
                )}
                <main className={styles.content}>{children}</main>

                {!isLoginPage && (
                    <nav className={styles.bottomNav} aria-label="Primary navigation">
                        <Link to="/" className={clsx(styles.navLink, isHomeRoute && styles.navLinkActive)} aria-label="Inicio">
                            <Home size={18} />
                            <span>Inicio</span>
                        </Link>
                        <Link to="/buscar" className={clsx(styles.navLink, location.pathname === '/buscar' && styles.navLinkActive)} aria-label="Buscar">
                            <FileText size={18} />
                            <span>Buscar</span>
                        </Link>
                        <Link to="/facturas/new" className={styles.navCenter} aria-label="Nueva factura">
                            <Plus size={24} />
                        </Link>
                        <Link to="/admin" className={clsx(styles.navLink, location.pathname === '/admin' && styles.navLinkActive)} aria-label="Catálogos">
                            <Grid2x2 size={18} />
                            <span>Catálogos</span>
                        </Link>
                        <Link to="/articulos" className={clsx(styles.navLink, location.pathname === '/articulos' && styles.navLinkActive)} aria-label="Artículos">
                            <Shirt size={18} />
                            <span>Artículos</span>
                        </Link>
                    </nav>
                )}
            </div>
        </div>
    );
}
