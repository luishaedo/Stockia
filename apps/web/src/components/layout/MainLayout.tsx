import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FileText, Grid2x2, ListTodo, LogOut, Menu, Package, Plus, Search } from 'lucide-react';
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

    const links = [
        { to: '/facturas', icon: FileText, label: 'Facturas' },
        { to: '/admin', icon: Grid2x2, label: 'Catálogos' },
        { to: '/admin/facturas', icon: ListTodo, label: 'Admin' }
    ];

    return (
        <div className={styles.appFrame}>
            <div className={styles.shell}>
                {!isLoginPage && (
                    <header className={styles.topBar}>
                        <Link to="/facturas" className={styles.brand}>
                            <span className={styles.brandIcon}><Package size={20} /></span>
                            <span>Stockia</span>
                        </Link>
                        {isAuthenticated && (
                            <div className={styles.topActions}>
                                <button type="button" className={styles.iconButton} aria-label="Open navigation menu">
                                    <Menu size={22} />
                                </button>
                                <button type="button" className={styles.logoutButton} onClick={handleLogout} aria-label="Log out">
                                    <LogOut size={14} />
                                </button>
                            </div>
                        )}
                    </header>
                )}

                <main className={styles.content}>{children}</main>

                {isAuthenticated && !isLoginPage && (
                    <nav className={styles.bottomNav} aria-label="Primary navigation">
                        <Link to="/facturas" className={clsx(styles.navLink, location.pathname === '/facturas' && styles.navLinkActive)} aria-label="Go to invoices">
                            <FileText size={21} />
                        </Link>
                        <Link to="/facturas?openSearch=true" className={styles.navLink} aria-label="Open invoice search">
                            <Search size={21} />
                        </Link>
                        <Link to="/facturas/new" className={styles.navCenter} aria-label="Create invoice">
                            <Plus size={22} />
                        </Link>
                        {links.map(({ to, icon: Icon, label }) => (
                            <Link key={to} to={to} className={clsx(styles.navLink, location.pathname === to && styles.navLinkActive)} aria-label={label}>
                                <Icon size={21} />
                            </Link>
                        )).slice(1)}
                    </nav>
                )}
            </div>
        </div>
    );
}
