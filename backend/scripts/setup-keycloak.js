/**
 * Keycloak Setup Script
 * 
 * Initializes the Keycloak realm, client, roles, and test user
 * for the Dragon Template AI project.
 * 
 * Usage: node scripts/setup-keycloak.js
 * 
 * Prerequisites: Keycloak must be running at http://localhost:8080
 */

const axios = require('axios');

require('dotenv').config();

const KC_URL = process.env.KEYCLOAK_URL;
const REALM = process.env.KEYCLOAK_REALM;
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID;
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET;

const missing = ['KEYCLOAK_URL', 'KEYCLOAK_REALM', 'KEYCLOAK_CLIENT_ID', 'KEYCLOAK_CLIENT_SECRET']
    .filter(key => !process.env[key]);
if (missing.length) {
    console.error(`❌ Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
}

const TEST_USER = {
    username: 'testuser',
    email: 'test@dragon.ai',
    firstName: 'Test',
    lastName: 'User',
    password: 'testpass123',
};

async function getAdminToken() {
    const res = await axios.post(
        `${KC_URL}/realms/master/protocol/openid-connect/token`,
        new URLSearchParams({
            client_id: 'admin-cli',
            username: 'admin',
            password: 'admin',
            grant_type: 'password',
        }),
    );
    return res.data.access_token;
}

async function setup() {
    console.log(`\n🔧 Setting up Keycloak at ${KC_URL}...\n`);

    // 1. Get admin token
    const token = await getAdminToken();
    const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
    console.log('✅ Admin token obtained');

    // 2. Create realm
    try {
        await axios.post(`${KC_URL}/admin/realms`, {
            realm: REALM,
            enabled: true,
        }, { headers });
        console.log(`✅ Realm "${REALM}" created`);
    } catch (e) {
        if (e.response?.status === 409) {
            console.log(`⚠️  Realm "${REALM}" already exists`);
        } else {
            throw new Error(`Failed to create realm: ${e.response?.data?.errorMessage || e.message}`);
        }
    }

    // 3. Create client
    try {
        await axios.post(`${KC_URL}/admin/realms/${REALM}/clients`, {
            clientId: CLIENT_ID,
            enabled: true,
            publicClient: false,
            directAccessGrantsEnabled: true,
            serviceAccountsEnabled: true,
            secret: CLIENT_SECRET,
            redirectUris: ['http://localhost:5173/*'],
            webOrigins: ['http://localhost:5173'],
        }, { headers });
        console.log(`✅ Client "${CLIENT_ID}" created`);
    } catch (e) {
        if (e.response?.status === 409) {
            console.log(`⚠️  Client "${CLIENT_ID}" already exists`);
        } else {
            throw new Error(`Failed to create client: ${e.response?.data?.errorMessage || e.message}`);
        }
    }

    // 4. Get client internal IDs
    const clients = (await axios.get(`${KC_URL}/admin/realms/${REALM}/clients`, { headers })).data;
    const appClient = clients.find(c => c.clientId === CLIENT_ID);
    const realmMgmtClient = clients.find(c => c.clientId === 'realm-management');

    if (!appClient || !realmMgmtClient) {
        throw new Error('Could not find required clients');
    }

    // 5. Get service account user and assign manage-users role
    const saUser = (await axios.get(
        `${KC_URL}/admin/realms/${REALM}/clients/${appClient.id}/service-account-user`,
        { headers },
    )).data;

    const roles = (await axios.get(
        `${KC_URL}/admin/realms/${REALM}/clients/${realmMgmtClient.id}/roles`,
        { headers },
    )).data;

    const manageUsersRole = roles.find(r => r.name === 'manage-users');
    if (!manageUsersRole) {
        throw new Error('manage-users role not found');
    }

    await axios.post(
        `${KC_URL}/admin/realms/${REALM}/users/${saUser.id}/role-mappings/clients/${realmMgmtClient.id}`,
        [{ id: manageUsersRole.id, name: manageUsersRole.name }],
        { headers },
    );
    console.log('✅ manage-users role assigned to service account');

    // 6. Create test user
    try {
        await axios.post(`${KC_URL}/admin/realms/${REALM}/users`, {
            username: TEST_USER.username,
            email: TEST_USER.email,
            firstName: TEST_USER.firstName,
            lastName: TEST_USER.lastName,
            enabled: true,
            emailVerified: true,
            credentials: [{
                type: 'password',
                value: TEST_USER.password,
                temporary: false,
            }],
        }, { headers });
        console.log(`✅ Test user "${TEST_USER.username}" created`);
    } catch (e) {
        if (e.response?.status === 409) {
            console.log(`⚠️  Test user "${TEST_USER.username}" already exists`);
        } else {
            throw new Error(`Failed to create user: ${e.response?.data?.errorMessage || e.message}`);
        }
    }

    console.log('\n🎉 Keycloak setup complete!\n');
    console.log('Test credentials:');
    console.log(`  Username: ${TEST_USER.username}`);
    console.log(`  Password: ${TEST_USER.password}`);
    console.log(`  Email:    ${TEST_USER.email}\n`);
}

setup().catch(err => {
    console.error(`\n❌ Setup failed: ${err.message}\n`);
    process.exit(1);
});
