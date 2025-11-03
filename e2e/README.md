# End-to-End Tests

This directory contains end-to-end (e2e) tests for the Trainboard application using [Playwright](https://playwright.dev/).

## Overview

The e2e tests verify the application's functionality from a user's perspective by running tests in a real browser. These tests cover:

- **home.spec.ts**: Basic page loading and UI element presence
- **settings.spec.ts**: Settings modal functionality (railway/station selection)
- **location.spec.ts**: Location modal functionality (geolocation features)

## Running Tests

### Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Playwright browsers:
   ```bash
   npx playwright install chromium
   ```

### Running All Tests

```bash
npm run test:e2e
```

This runs all e2e tests in headless mode (without a visible browser window).

### Running Tests with UI

To run tests with Playwright's interactive UI mode:

```bash
npm run test:e2e:ui
```

This opens a test runner UI where you can:
- Run individual tests
- See test execution in real-time
- Debug failing tests
- View traces and screenshots

### Running Tests in Headed Mode

To see the browser while tests run:

```bash
npm run test:e2e:headed
```

### Running Specific Tests

To run a specific test file:

```bash
npx playwright test e2e/home.spec.ts
```

To run a specific test by name:

```bash
npx playwright test --grep "should load the home page"
```

## Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

The report includes:
- Test results
- Screenshots of failures
- Execution traces
- Performance metrics

## Debugging Tests

### Using the Inspector

Run tests in debug mode:

```bash
npx playwright test --debug
```

This opens the Playwright Inspector where you can:
- Step through tests line by line
- Inspect page elements
- View console logs
- See network requests

### Using VS Code Extension

Install the [Playwright Test for VS Code](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright) extension to:
- Run tests from the editor
- Set breakpoints
- See test results inline
- Record new tests

## Writing New Tests

1. Create a new `.spec.ts` file in the `e2e/` directory
2. Import test utilities:
   ```typescript
   import { test, expect } from '@playwright/test';
   ```
3. Write test cases:
   ```typescript
   test.describe('Feature Name', () => {
     test('should do something', async ({ page }) => {
       await page.goto('/');
       await expect(page.locator('#element-id')).toBeVisible();
     });
   });
   ```

See the [Playwright documentation](https://playwright.dev/docs/writing-tests) for more details.

## Continuous Integration

E2e tests run automatically on:
- Pull requests to `main`
- Pushes to `main`

The CI workflow:
1. Installs dependencies
2. Installs Playwright browsers
3. Runs all e2e tests
4. Uploads test reports as artifacts (available for 30 days)

View test results in the GitHub Actions tab of the repository.

## Configuration

The Playwright configuration is in `playwright.config.ts`. Key settings:

- **testDir**: `./e2e` - Location of test files
- **webServer**: Automatically starts `npm run dev` before tests
- **baseURL**: `http://localhost:5173` - Base URL for tests
- **projects**: Currently configured to run tests in Chromium only

To test in multiple browsers, add more projects:

```typescript
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
],
```

Then install additional browsers:

```bash
npx playwright install firefox webkit
```

## Tips

- Tests automatically start the dev server (`npm run dev`) before running
- Use `page.pause()` to pause test execution for debugging
- Check `playwright-report/` for detailed HTML reports
- Use `test.only()` to run a single test during development
- Use `test.skip()` to temporarily disable a test
