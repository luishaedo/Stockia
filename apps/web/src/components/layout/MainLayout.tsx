import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Package } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';

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

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
            <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
                <div className="container max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center space-x-2 text-xl font-bold text-white hover:text-blue-400 transition-colors">
                        <Package className="h-6 w-6 text-blue-500" />
                        <span>Stockia</span>
                    </Link>
                    <nav>
                        {isAuthenticated && !isLoginPage && (
                            <Button variant="ghost" size="sm" onClick={handleLogout}>Sign out</Button>
                        )}
                    </nav>
                </div>
            </header>
            <main className="container max-w-7xl mx-auto px-4 py-8">
                {children}
            </main>
        </div>
    );
}
