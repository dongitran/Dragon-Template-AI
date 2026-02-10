jest.mock('axios');
const axios = require('axios');
const { decodeTokenPayload, requestKeycloakToken, createKeycloakUser } = require('../../src/utils/keycloak');

describe('decodeTokenPayload', () => {
    it('should decode JWT payload from access token', () => {
        const payload = { sub: 'user-123', email: 'test@test.com', preferred_username: 'testuser' };
        const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
        const fakeToken = `header.${encodedPayload}.signature`;

        const result = decodeTokenPayload(fakeToken);

        expect(result).toEqual(payload);
    });

    it('should handle complex payloads', () => {
        const payload = { sub: 'id', name: 'Tên tiếng Việt', roles: ['admin', 'user'] };
        const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
        const token = `h.${encoded}.s`;

        expect(decodeTokenPayload(token)).toEqual(payload);
    });
});

describe('requestKeycloakToken', () => {
    afterEach(() => jest.clearAllMocks());

    it('should send POST to Keycloak token endpoint with params', async () => {
        const mockData = { access_token: 'at', refresh_token: 'rt', expires_in: 300 };
        axios.post.mockResolvedValue({ data: mockData });

        const result = await requestKeycloakToken({ grant_type: 'password', username: 'u', password: 'p' });

        expect(result).toEqual(mockData);
        expect(axios.post).toHaveBeenCalledTimes(1);

        const [url, params, config] = axios.post.mock.calls[0];
        expect(url).toContain('/protocol/openid-connect/token');
        expect(config.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    });

    it('should propagate errors from Keycloak', async () => {
        axios.post.mockRejectedValue(new Error('Keycloak down'));

        await expect(requestKeycloakToken({ grant_type: 'password' })).rejects.toThrow('Keycloak down');
    });
});

describe('createKeycloakUser', () => {
    afterEach(() => jest.clearAllMocks());

    it('should send POST to admin users endpoint', async () => {
        axios.post.mockResolvedValue({ status: 201 });

        const userData = { username: 'new', email: 'new@test.com', enabled: true };
        await createKeycloakUser('admin-token', userData);

        expect(axios.post).toHaveBeenCalledTimes(1);
        const [url, data, config] = axios.post.mock.calls[0];
        expect(url).toContain('/admin/realms/');
        expect(url).toContain('/users');
        expect(data).toEqual(userData);
        expect(config.headers.Authorization).toBe('Bearer admin-token');
    });

    it('should propagate 409 error for duplicate user', async () => {
        const error = new Error('Conflict');
        error.response = { status: 409, data: { errorMessage: 'User exists' } };
        axios.post.mockRejectedValue(error);

        await expect(createKeycloakUser('token', { username: 'dup' })).rejects.toThrow('Conflict');
    });
});
