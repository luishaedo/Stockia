import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, Grid2x2, Home, Plus } from 'lucide-react';
import clsx from 'clsx';
import styles from './MainLayout.module.css';

interface MainLayoutProps {
    children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
    const location = useLocation();

    const isLoginPage = location.pathname === '/login';

    const isHomeRoute = location.pathname === '/' || location.pathname.startsWith('/facturas');

    return (
        <div className={styles.appFrame}>
            <div className={styles.shell}>
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
                        <div className={styles.navSpacer} aria-hidden="true" />
                    </nav>
                )}
            </div>
        </div>
    );
}
