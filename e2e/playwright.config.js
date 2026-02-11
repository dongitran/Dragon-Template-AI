import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,  // ✅ Enable parallel execution
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 4 : 2,  // ✅ 4 workers in CI, 2 local
    reporter: process.env.CI ? 'github' : 'list',

    use: {
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'on-first-retry',
    },

    projects: [
        {
            name: 'chromium',
            use: { browserName: 'chromium' },
        },
    ],
});
