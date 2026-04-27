import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, authTokenStore } from '../services/api';

interface AuthContextValue {
    isAuthenticated: boolean;
    isAuthResolved: boolean;
    login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(Boolean(authTokenStore.get()));
    const [isAuthResolved, setIsAuthResolved] = useState(false);

    useEffect(() => {
        let mounted = true;

        const restoreAuth = async () => {
            if (!authTokenStore.get()) {
                await api.restoreSession();
            }

            if (mounted) {
                setIsAuthenticated(Boolean(authTokenStore.get()));
                setIsAuthResolved(true);
            }
        };

        const handleAuthChanged = () => {
            if (!mounted) {
                return;
            }
            setIsAuthenticated(Boolean(authTokenStore.get()));
        };

        window.addEventListener('stockia-auth-changed', handleAuthChanged);
        void restoreAuth();

        return () => {
            mounted = false;
            window.removeEventListener('stockia-auth-changed', handleAuthChanged);
        };
    }, []);

    const login = useCallback(async (username: string, password: string, rememberMe = true) => {
        await api.login(username, password, rememberMe);
        setIsAuthenticated(true);
        setIsAuthResolved(true);
    }, []);

    const logout = useCallback(async () => {
        await api.logout();
        setIsAuthenticated(false);
        setIsAuthResolved(true);
    }, []);

    const value = useMemo(() => ({ isAuthenticated, isAuthResolved, login, logout }), [isAuthenticated, isAuthResolved, login, logout]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
