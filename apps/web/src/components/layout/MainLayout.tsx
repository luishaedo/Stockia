import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FileText, Grid2x2, KeyRound, LogOut, Plus, Search, Shapes } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';
import styles from './MainLayout.module.css';

interface MainLayoutProps {
    children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
    const { isAuthenticated, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const isLoginPage = location.pathname === '/login';

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    const isHomeActive = location.pathname === '/' || location.pathname.startsWith('/facturas');

    return (
        <div className={styles.appFrame}>
            <div className={styles.shell}>
                {!isLoginPage && (
                    <header className={styles.topBar}>
                        <Link to="/" className={styles.brand}>
                            <span>Stockia</span>
                        </Link>
                        <div className={styles.topActions}>
                            <Link to="/admin" className={styles.iconButton} aria-label="Open admin">
                                <KeyRound size={20} />
                            </Link>
                            {isAuthenticated && (
                                <button type="button" className={styles.logoutButton} onClick={handleLogout} aria-label="Log out">
                                    <LogOut size={14} />
                                </button>
                            )}
                        </div>
                    </header>
                )}

                <main className={styles.content}>{children}</main>

                {!isLoginPage && (
                    <nav className={styles.bottomNav} aria-label="Primary navigation">
                        <Link to="/" className={clsx(styles.navLink, isHomeActive && styles.navLinkActive)} aria-label="Go to invoices">
                            <FileText size={21} />
                        </Link>
                        <Link to="/?openSearch=true" className={styles.navLink} aria-label="Open invoice search">
                            <Search size={21} />
                        </Link>
                        <Link to="/facturas/new" className={styles.navCenter} aria-label="Create invoice">
                            <Plus size={22} />
                        </Link>
                        <Link to="/admin" className={clsx(styles.navLink, location.pathname === '/admin' && styles.navLinkActive)} aria-label="Catálogos">
                            <Grid2x2 size={21} />
                        </Link>
                        <Link to="/articulos" className={clsx(styles.navLink, location.pathname === '/articulos' && styles.navLinkActive)} aria-label="Artículos">
                            <Shapes size={21} />
                        </Link>
                    </nav>
                )}
            </div>
        </div>
    );
}
