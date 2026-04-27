import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronUp, FileText, Grid2x2, Home, KeyRound, LogOut, Plus, Shirt } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';
import styles from './MainLayout.module.css';

interface MainLayoutProps {
    children: ReactNode;
}

const SESSION_EXPIRED_MESSAGE = 'Tu sesión expiró, iniciá sesión nuevamente.';

export function MainLayout({ children }: MainLayoutProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, logout } = useAuth();
    const [isNavCollapsed, setIsNavCollapsed] = useState(false);
    const [isMobileViewport, setIsMobileViewport] = useState(false);
    const [authToast, setAuthToast] = useState<string | null>(null);
    const lastScrollYRef = useRef(0);

    const isLoginPage = location.pathname === '/login';

    const isHomeRoute = location.pathname === '/' || location.pathname.startsWith('/facturas');

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const mediaQuery = window.matchMedia('(max-width: 899px)');
        const syncViewport = () => {
            setIsMobileViewport(mediaQuery.matches);
            if (!mediaQuery.matches) {
                setIsNavCollapsed(false);
            }
        };

        syncViewport();
        mediaQuery.addEventListener('change', syncViewport);

        return () => {
            mediaQuery.removeEventListener('change', syncViewport);
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        lastScrollYRef.current = window.scrollY;

        const onScroll = () => {
            if (!isMobileViewport) {
                return;
            }

            const currentScrollY = window.scrollY;
            const delta = currentScrollY - lastScrollYRef.current;
            const isPastCollapseOffset = currentScrollY > 72;

            if (delta > 8 && isPastCollapseOffset) {
                setIsNavCollapsed(true);
            } else if (delta < -6) {
                setIsNavCollapsed(false);
            }

            lastScrollYRef.current = currentScrollY;
        };

        window.addEventListener('scroll', onScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', onScroll);
        };
    }, [isMobileViewport]);

    useEffect(() => {
        const onSessionExpired = () => {
            setAuthToast(SESSION_EXPIRED_MESSAGE);
            navigate('/login', { replace: true, state: { from: location } });
        };

        window.addEventListener('stockia-auth-session-expired', onSessionExpired);

        return () => {
            window.removeEventListener('stockia-auth-session-expired', onSessionExpired);
        };
    }, [location, navigate]);

    useEffect(() => {
        if (!authToast) {
            return;
        }

        const timeout = window.setTimeout(() => setAuthToast(null), 3500);
        return () => window.clearTimeout(timeout);
    }, [authToast]);

    return (
        <div className={styles.appFrame}>
            <div className={styles.shell}>
                {!isLoginPage && (
                    <div className={styles.authDock}>
                        {!isAuthenticated ? (
                            <Link to="/login" className={styles.authAction} aria-label="Ingresar">
                                <KeyRound size={16} />
                            </Link>
                        ) : (
                            <button type="button" className={styles.authAction} onClick={() => void logout()} aria-label="Cerrar sesión">
                                <LogOut size={16} />
                            </button>
                        )}
                    </div>
                )}
                <main className={styles.content}>{children}</main>
                {authToast && (
                    <div className={styles.authToast} role="status" aria-live="polite">
                        {authToast}
                    </div>
                )}
                {!isLoginPage && (
                    <>
                        <nav
                            className={clsx(styles.bottomNav, isNavCollapsed && styles.bottomNavCollapsed)}
                            aria-label="Primary navigation"
                            aria-hidden={isNavCollapsed}
                        >
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

                        <button
                            type="button"
                            className={clsx(styles.navToggle, isNavCollapsed && styles.navToggleVisible)}
                            onClick={() => setIsNavCollapsed(false)}
                            aria-label="Mostrar navegación"
                            aria-expanded={!isNavCollapsed}
                        >
                            <ChevronUp size={18} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
