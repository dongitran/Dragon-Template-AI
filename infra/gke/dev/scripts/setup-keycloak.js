/**
 * Keycloak Dev Setup Script
 *
 * Usage:
 *   node setup-keycloak.js --admin-password=xxx --client-secret=xxx --test-user-password=xxx
 *
 * Example:
 *   node setup-keycloak.js --admin-password=MyAdmin123 --client-secret=my-secret --test-user-password=Test123
 */

const https = require('https');
const http = require('http');

function parseArgs() {
    const args = {};
    process.argv.slice(2).forEach((arg) => {
        const match = arg.match(/^--([^=]+)=(.+)$/);
        if (match) args[match[1]] = match[2];
    });
    return args;
}

const args = parseArgs();
const ADMIN_PASSWORD = args['admin-password'];
const CLIENT_SECRET = args['client-secret'];
const TEST_USER_PASSWORD = args['test-user-password'];

const missing = [];
if (!ADMIN_PASSWORD) missing.push('--admin-password');
if (!CLIENT_SECRET) missing.push('--client-secret');
if (!TEST_USER_PASSWORD) missing.push('--test-user-password');

if (missing.length) {
    console.error(`Missing required args: ${missing.join(', ')}`);
    console.error('Usage: node setup-keycloak.js --admin-password=xxx --client-secret=xxx --test-user-password=xxx');
    process.exit(1);
}

const KC_URL = 'https://dev-keycloak.dragon-template.xyz';
const REALM = 'dragon';
const CLIENT_ID = 'dragon-app';
const DEV_FRONTEND_URL = 'https://dev.dragon-template.xyz';

const TEST_USER = {
    username: 'testuser',
    email: 'test@dragon.ai',
    firstName: 'Test',
    lastName: 'User',
    password: TEST_USER_PASSWORD,
};

function request(url, options = {}) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const req = mod.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                const result = { status: res.statusCode, data: data ? JSON.parse(data) : null };
                resolve(result);
            });
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

async function post(url, body, headers = {}) {
    const isForm = typeof body === 'string';
    return request(url, {
        method: 'POST',
        headers: {
            'Content-Type': isForm ? 'application/x-www-form-urlencoded' : 'application/json',
            ...headers,
        },
        body: isForm ? body : JSON.stringify(body),
    });
}

async function get(url, headers = {}) {
    return request(url, { method: 'GET', headers });
}

async function getAdminToken() {
    const res = await post(
        `${KC_URL}/realms/master/protocol/openid-connect/token`,
        `client_id=admin-cli&username=admin&password=${encodeURIComponent(ADMIN_PASSWORD)}&grant_type=password`,
    );
    if (res.status !== 200) throw new Error(`Auth failed (${res.status}): ${JSON.stringify(res.data)}`);
    return res.data.access_token;
}

async function setup() {
    console.log(`\nSetting up Keycloak at ${KC_URL}...\n`);

    const token = await getAdminToken();
    const auth = { Authorization: `Bearer ${token}` };
    console.log('[ok] Admin token obtained');

    // Create realm
    const realmRes = await post(`${KC_URL}/admin/realms`, { realm: REALM, enabled: true }, auth);
    if (realmRes.status === 201) console.log(`[ok] Realm "${REALM}" created`);
    else if (realmRes.status === 409) console.log(`[skip] Realm "${REALM}" already exists`);
    else throw new Error(`Failed to create realm: ${realmRes.status}`);

    // Create client
    const clientRes = await post(`${KC_URL}/admin/realms/${REALM}/clients`, {
        clientId: CLIENT_ID,
        enabled: true,
        publicClient: false,
        directAccessGrantsEnabled: true,
        serviceAccountsEnabled: true,
        secret: CLIENT_SECRET,
        redirectUris: [`${DEV_FRONTEND_URL}/*`],
        webOrigins: [DEV_FRONTEND_URL],
    }, auth);
    if (clientRes.status === 201) console.log(`[ok] Client "${CLIENT_ID}" created`);
    else if (clientRes.status === 409) console.log(`[skip] Client "${CLIENT_ID}" already exists`);
    else throw new Error(`Failed to create client: ${clientRes.status}`);

    // Get client IDs
    const clients = (await get(`${KC_URL}/admin/realms/${REALM}/clients`, auth)).data;
    const appClient = clients.find((c) => c.clientId === CLIENT_ID);
    const realmMgmt = clients.find((c) => c.clientId === 'realm-management');
    if (!appClient || !realmMgmt) throw new Error('Required clients not found');

    // Assign manage-users role to service account
    const saUser = (await get(`${KC_URL}/admin/realms/${REALM}/clients/${appClient.id}/service-account-user`, auth)).data;
    const roles = (await get(`${KC_URL}/admin/realms/${REALM}/clients/${realmMgmt.id}/roles`, auth)).data;
    const manageUsersRole = roles.find((r) => r.name === 'manage-users');
    if (!manageUsersRole) throw new Error('manage-users role not found');

    await post(
        `${KC_URL}/admin/realms/${REALM}/users/${saUser.id}/role-mappings/clients/${realmMgmt.id}`,
        [{ id: manageUsersRole.id, name: manageUsersRole.name }],
        auth,
    );
    console.log('[ok] manage-users role assigned to service account');

    // Create test user
    const userRes = await post(`${KC_URL}/admin/realms/${REALM}/users`, {
        username: TEST_USER.username,
        email: TEST_USER.email,
        firstName: TEST_USER.firstName,
        lastName: TEST_USER.lastName,
        enabled: true,
        credentials: [{ type: 'password', value: TEST_USER.password, temporary: false }],
    }, auth);
    if (userRes.status === 201) console.log(`[ok] Test user "${TEST_USER.username}" created`);
    else if (userRes.status === 409) console.log(`[skip] Test user "${TEST_USER.username}" already exists`);
    else throw new Error(`Failed to create user: ${userRes.status}`);

    console.log('\nKeycloak dev setup complete!');
    console.log(`  Username: ${TEST_USER.username}`);
    console.log(`  Password: ${TEST_USER.password}\n`);
}

setup().catch((err) => {
    console.error(`\nSetup failed: ${err.message}\n`);
    process.exit(1);
});
