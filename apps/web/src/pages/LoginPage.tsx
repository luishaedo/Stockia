import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';

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
            setError(submitError?.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto mt-16">
            <Card title="Sign in" className="shadow-lg">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Input
                        label="Username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        autoComplete="username"
                        required
                    />
                    <Input
                        type="password"
                        label="Password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        required
                    />

                    {error && (
                        <div className="text-red-500 text-sm p-2 bg-red-500/10 rounded">{error}</div>
                    )}

                    <div className="flex justify-end mt-2">
                        <Button type="submit" isLoading={isLoading}>Sign in</Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
