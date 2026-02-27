import { authTokenStore, HttpClient } from './httpClient';

export class AuthApiService {
    constructor(private client: HttpClient) {}

    async login(username: string, password: string): Promise<string> {
        const response = await fetch(`${this.client.getBaseURL()}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        await this.client.assertOk(response, 'No pudimos iniciar sesión');
        const data = await response.json() as { accessToken: string };
        authTokenStore.set(data.accessToken);
        return data.accessToken;
    }
}
