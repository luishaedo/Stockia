import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, authTokenStore } from '../services/api';

interface AuthContextValue {
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(Boolean(authTokenStore.get()));

    useEffect(() => {
        const handleAuthChanged = () => {
            setIsAuthenticated(Boolean(authTokenStore.get()));
        };

        window.addEventListener('stockia-auth-changed', handleAuthChanged);
        return () => window.removeEventListener('stockia-auth-changed', handleAuthChanged);
    }, []);


    const login = useCallback(async (username: string, password: string) => {
        await api.login(username, password);
        setIsAuthenticated(true);
    }, []);

    const logout = useCallback(() => {
        authTokenStore.clear();
        setIsAuthenticated(false);
    }, []);

    const value = useMemo(() => ({ isAuthenticated, login, logout }), [isAuthenticated, login, logout]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
