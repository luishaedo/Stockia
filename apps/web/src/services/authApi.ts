import { authTokenStore, HttpClient } from './httpClient';

export class AuthApiService {
    constructor(private client: HttpClient) {}

    async login(username: string, password: string, rememberMe = true): Promise<string> {
        const response = await fetch(`${this.client.getBaseURL()}/auth/login`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, rememberMe })
        });

        await this.client.assertOk(response, 'No pudimos iniciar sesión');
        const data = await response.json() as { accessToken: string };
        authTokenStore.set(data.accessToken);
        return data.accessToken;
    }

    async restoreSession(): Promise<boolean> {
        const response = await fetch(`${this.client.getBaseURL()}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            authTokenStore.clear();
            return false;
        }

        const data = await response.json() as { accessToken?: string };
        if (!data.accessToken) {
            authTokenStore.clear();
            return false;
        }

        authTokenStore.set(data.accessToken);
        return true;
    }

    async logout(): Promise<void> {
        try {
            await fetch(`${this.client.getBaseURL()}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
        } finally {
            authTokenStore.clear();
        }
    }
}
