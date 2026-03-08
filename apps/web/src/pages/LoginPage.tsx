import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import styles from './LoginPage.module.css';

export function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const redirectTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/facturas';

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            await login(username.trim(), password);
            navigate(redirectTo, { replace: true });
        } catch (submitError: any) {
            setError(submitError?.message || 'No pudimos iniciar sesión. Verificá tus credenciales.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.page}>
            <Card className={styles.loginCard}>
                <div className={styles.content}>
                    <header className={styles.header}>
                        <span className={styles.badge}>Stockia</span>
                        <h1 className={styles.title}>Iniciar sesión</h1>
                        <p className={styles.subtitle}>Accedé a tu panel para gestionar facturas y catálogo.</p>
                    </header>

                    <form onSubmit={handleSubmit} className={styles.form}>
                        <Input
                            label="Usuario"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            autoComplete="username"
                            required
                        />
                        <Input
                            type="password"
                            label="Contraseña"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            autoComplete="current-password"
                            required
                        />

                        {error && <div className={styles.error}>{error}</div>}

                        <div className={styles.actions}>
                            <Button type="submit" isLoading={isLoading} className={styles.submit}>Iniciar sesión</Button>
                        </div>
                    </form>

                </div>
            </Card>
        </div>
    );
}
