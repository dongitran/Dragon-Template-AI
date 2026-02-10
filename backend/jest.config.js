module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.js', '**/*.test.js'],
    collectCoverageFrom: ['src/**/*.js', '!src/index.js'],
    coverageDirectory: 'coverage',
};
