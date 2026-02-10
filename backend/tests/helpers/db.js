const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

/**
 * Connect to an in-memory MongoDB instance.
 * Call in beforeAll().
 */
async function connect() {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
}

/**
 * Disconnect and stop the in-memory MongoDB instance.
 * Call in afterAll().
 */
async function disconnect() {
    await mongoose.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
    }
}

/**
 * Clear all collections.
 * Call in afterEach() if needed.
 */
async function clearDatabase() {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
}

module.exports = { connect, disconnect, clearDatabase };
