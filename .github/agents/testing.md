# Testing Agent Instructions

## Testing Framework
This project uses **Vitest** for unit testing. Vitest is a fast, modern test framework specifically designed for Vite projects, providing native integration and optimal performance.

## Running Tests

### Basic Commands
```bash
npm test              # Run all tests once
npm test -- --watch   # Run in watch mode
npm test -- --coverage # Run with coverage report
```

### Test Location
All tests are located in `src/__tests__/` directory and follow the naming pattern `*.test.ts`.

## Existing Tests

### src/__tests__/api.test.ts
Tests for API client functionality.

### src/__tests__/api_query.test.ts
Tests for API query construction.

### src/__tests__/boardRendererVisibility.test.ts
Tests for board renderer visibility integration with Page Visibility API.

### src/__tests__/departureListVisibility.test.ts
Tests for departures list visibility integration and state management.

### src/__tests__/holidays.test.ts
Tests for holiday data parsing and handling.

### src/__tests__/location.test.ts
Tests for geolocation utilities, distance calculation, and nearby station finding.

### src/__tests__/minutes_updater.test.ts
Tests for the minutes countdown updater functionality.

### src/__tests__/parsing.test.ts
Tests for parsing utilities and data transformation functions.

### src/__tests__/rendering.test.ts
Tests for departure board rendering logic using Lit components.

### src/__tests__/routing.test.ts
Tests for URL routing, railway/station name matching, and URL parameter parsing.

### src/__tests__/tickManager.test.ts
Tests for the TickManager interval management system.

### src/__tests__/tickManagerVisibility.test.ts
Tests for TickManager integration with Page Visibility API.

### src/__tests__/trainrow.test.ts
Tests for TrainRow component rendering and behavior.

### src/__tests__/ui.test.ts
Tests for UI components and DOM manipulation.

### src/__tests__/visibilityIntegration.test.ts
Tests for integrated visibility management across components.

### src/__tests__/visibilityManager.test.ts
Tests for the VisibilityManager module and Page Visibility API integration.

## Writing New Tests

### Test File Structure
```typescript
import { describe, test, expect } from 'vitest';
import { functionToTest } from '../module';

describe('Module Name', () => {
  describe('functionToTest', () => {
    test('should handle normal case', () => {
      const result = functionToTest(input);
      expect(result).toBe(expectedOutput);
    });

    test('should handle edge case', () => {
      const result = functionToTest(edgeInput);
      expect(result).toBe(edgeOutput);
    });

    test('should handle error case', () => {
      expect(() => functionToTest(invalidInput)).toThrow();
    });
  });
});
```

### Test Naming
- Use descriptive test names that explain what is being tested
- Format: `should <expected behavior> when <condition>`
- Examples:
  - `should return parsed station name`
  - `should handle missing data gracefully`
  - `should throw error for invalid input`

### Test Organization
- Group related tests using `describe` blocks
- One test file per module or logical grouping
- Keep tests focused and independent
- Avoid test interdependencies

## What to Test

### Priority Testing Areas
1. **Utility Functions** (src/lib/utils.ts)
   - Data parsing and transformation
   - Date/time formatting
   - String manipulation
   - Validation functions

2. **API Response Parsing** (src/odpt/api.ts)
   - Response validation
   - Data extraction
   - Error handling

3. **Caching Logic** (src/lib/cache.ts)
   - Cache hit/miss scenarios
   - TTL expiration
   - Cache invalidation

4. **Data Transformations**
   - Station name parsing
   - Train data formatting
   - Time calculations

5. **URL Routing** (src/routing.ts)
   - URL parameter parsing
   - Railway/station name matching (exact, partial, case-insensitive)
   - URL generation and updates

6. **Geolocation** (src/lib/location.ts)
   - Distance calculation (Haversine formula)
   - Nearby station finding
   - Distance formatting

7. **Visibility Management** (src/lib/visibilityManager.ts)
   - Page Visibility API integration
   - Callback registration and execution
   - State transitions

8. **Interval Management** (src/lib/tickManager.ts)
   - Tick scheduling and execution
   - Pause/resume functionality
   - Integration with visibility manager

### What NOT to Test
- Third-party libraries (Vite, etc.)
- Browser APIs (unless mocked)
- External API endpoints (use mocks)
- UI rendering (unless critical business logic)

## Mocking

### Mocking External Dependencies
```typescript
import { vi } from 'vitest';

// Mock a module
vi.mock('./api', () => ({
  fetchTrainData: vi.fn(() => Promise.resolve(mockData))
}));

// Mock a function
const mockFn = vi.fn();
mockFn.mockReturnValue(result);
mockFn.mockResolvedValue(asyncResult);
```

### Mock Data
- Create realistic mock data based on ODPT API responses
- Store mock data in test files or separate mock files
- Keep mock data minimal but representative

## Assertions

### Common Expectations
```typescript
// Equality
expect(value).toBe(expected);           // Same reference
expect(value).toEqual(expected);        // Deep equality

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeDefined();
expect(value).toBeNull();

// Numbers
expect(number).toBeGreaterThan(min);
expect(number).toBeLessThan(max);
expect(number).toBeCloseTo(float, precision);

// Strings
expect(string).toMatch(/pattern/);
expect(string).toContain(substring);

// Arrays
expect(array).toHaveLength(count);
expect(array).toContain(item);
expect(array).toEqual(expect.arrayContaining([item]));

// Objects
expect(obj).toHaveProperty('key');
expect(obj).toMatchObject({ key: value });

// Errors
expect(() => fn()).toThrow();
expect(() => fn()).toThrow(ErrorType);
expect(() => fn()).toThrow('error message');

// Async
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();
```

## Test Coverage

### Coverage Goals
- Aim for high coverage of utility functions
- Focus on critical business logic
- Don't obsess over 100% coverage
- Prioritize meaningful tests over coverage percentage

### Running Coverage
```bash
npm test -- --coverage
```

### Coverage Report
- HTML report: `coverage/index.html`
- Console summary shows line/branch/function coverage
- Review uncovered lines to identify gaps

## Best Practices

### Test Independence
- Each test should run independently
- Don't rely on test execution order
- Clean up after tests (if needed)
- Use `beforeEach`/`afterEach` for setup/teardown

### Test Data
- Use descriptive variable names
- Keep test data close to the test
- Make test data obvious and minimal
- Avoid magic numbers/strings

### Test Readability
- Keep tests simple and focused
- One assertion per test (when possible)
- Use helper functions for common setup
- Add comments for complex test logic

### Performance
- Keep tests fast (avoid unnecessary delays)
- Mock slow operations (API calls, file I/O)
- Use `test.concurrent` for independent tests
- Avoid testing implementation details

## Debugging Tests

### Debug Commands
```bash
# Run specific test file
npm test -- parsing.test.ts

# Run tests matching pattern
npm test -- --grep "station name"

# Run with verbose output
npm test -- --reporter=verbose
```

### Debug in IDE
- Use debugger statements in tests
- Set breakpoints in test files
- Use IDE's test runner integration
- Inspect test failure stack traces

## Adding Tests for New Features

### Workflow
1. Write tests BEFORE implementing the feature (TDD)
2. Tests should fail initially
3. Implement the feature
4. Tests should pass
5. Refactor if needed, keeping tests green

### Test Checklist
- [ ] Test happy path (normal case)
- [ ] Test edge cases (empty, null, undefined)
- [ ] Test error conditions
- [ ] Test boundary values
- [ ] Test async behavior (if applicable)

## Fixing Failing Tests

### Investigation Steps
1. Read the error message carefully
2. Check what the test expects vs. what it got
3. Review recent code changes
4. Run the test in isolation
5. Use debugger to step through code
6. Check for test data issues

### Common Causes
- API response format changed
- Breaking change in dependencies
- Incorrect mock data
- Race conditions in async tests
- Test assumptions no longer valid

## TypeScript in Tests

### Type Safety
- Import types for test data
- Use proper types for mock functions
- Avoid `any` in tests
- Use type assertions sparingly

### Example
```typescript
import type { StationData, TrainInfo } from '../odpt/types';

const mockStation: StationData = {
  id: 'odpt.Station:Tokyu.Toyoko.MusashiKosugi',
  name: '武蔵小杉',
  // ...
};

test('should parse station data', () => {
  const result = parseStation(mockStation);
  expect(result).toBeDefined();
});
```

## Continuous Integration

### GitHub Actions
- Tests run automatically on push to `main`
- Build must succeed before deployment
- Test failures block deployment
- View test results in Actions tab

### Local Pre-Commit
Before committing:
```bash
npm test              # Verify tests pass
npm run typecheck     # Verify types
npm run build         # Verify build
```
