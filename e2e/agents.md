# E2E Testing — Dragon Template AI

## Spec File Format

Every `.spec.js` file must include a **header comment block** at the top listing all test cases. This makes it easy to review test coverage without reading the full file.

### Format

```javascript
/**
 * [File description]
 *
 * Test cases:
 * 1. [test name]
 * 2. [test name]
 * ...
 */
```

### Example

```javascript
/**
 * Authentication flow E2E tests.
 *
 * Test cases:
 * 1. should redirect unauthenticated users to login page
 * 2. should display login page with correct elements
 * 3. should login successfully with valid credentials
 */
```

## Folder Structure

```
e2e/
├── tests/
│   ├── ui/                    # Frontend browser tests (Playwright page)
│   │   ├── auth.spec.js      # Login, register, session, logout
│   │   └── navigation.spec.js # Sidebar, page routing, collapse
│   └── api/                   # Backend API tests (Playwright request)
│       └── auth-api.spec.js   # REST endpoints, cookies, error codes
├── playwright.config.js
├── agents.md
├── .gitignore
└── package.json
```

- `tests/ui/` — Tests that open a browser and interact with UI elements
- `tests/api/` — Tests that call REST API endpoints directly (no browser UI)

## Running Tests

```bash
npm test              # headless (all tests)
npm run test:headed   # with browser visible
npm run test:ui       # interactive UI mode
npm run test:debug    # step-by-step debug
```

## Writing Tests

- Use `getByRole`, `getByPlaceholder`, `getByText` — avoid CSS selectors
- Use `{ exact: true }` or `getByRole` when text matches multiple elements
- Group related tests with `test.describe`
- Use `test.beforeEach` for shared setup (e.g., login)
- Tests run sequentially (`workers: 1`) because auth state matters
- API tests use `request` fixture — cookies persist within `test.describe`
