# Development Agent Instructions

## When Making Code Changes

### Pre-Change Checklist

1. Run `npm install` to ensure dependencies are installed
2. Run `npm test` to check current test status
3. Run `npm run typecheck` to verify type correctness
4. Run `npm run build` to ensure the project builds successfully

### During Development

1. Use `npm run dev` for live development with HMR
2. Make minimal, focused changes
3. Follow existing code patterns and style
4. Preserve working functionality
5. Add or update tests as needed

### Refactoring policy

Because this repository is small and we own the entire webapp, most refactors can be done atomically across the codebase. You do not need to maintain backward compatibility between internal modules or components when doing an internal refactor — it's acceptable to update all call sites in the same change. That said, keep these guardrails:

- Keep changes small and focused; prefer a single logical change per PR.
- Update or add tests and run the Pre-Change Checklist before committing.
- If a change affects external integrations (CI, published packages, or external APIs), clearly note the impact in the commit/PR and add documentation or migration notes where appropriate.

### Post-Change Checklist

1. Run `npm test` to verify tests pass
2. Run `npm run typecheck` to check types
3. Run `npm run format` to format code
4. Run `npm run build` to verify production build
5. Test the built output in `dist/`

## TypeScript Development

### Type Safety

- Always define proper types for function parameters and return values
- Use the types defined in `src/odpt/types.ts` for consistency
- Avoid using `any` - use `unknown` and type guards if needed
- Leverage TypeScript's inference when appropriate

### Module Organization

The codebase is organized into subdirectories for better separation of concerns:

#### src/lib/ - Core Utilities
- `cache.ts` — Caching logic
- `config.ts` — Configuration and API key management
- `constants.ts` — Application constants
- `location.ts` — Geolocation logic
- `tickManager.ts` — Interval management for refresh operations
- `utils.ts` — General utilities
- `visibilityManager.ts` — Page Visibility API integration

#### src/odpt/ - ODPT API Integration
- `api.ts` — API calls to ODPT endpoints
- `dataLoaders.ts` — Data loading and railway metadata
- `types.ts` — TypeScript type definitions for ODPT

#### src/ui/ - UI and Rendering
- `renderBoard.ts` — Main board rendering logic
- `settings.ts` — Settings modal and controls
- `departures.ts` — Departure-related UI
- `trainTypeRewrites.ts` — Train type name rewrites
- `trainTypeStyles.ts` — Train type styling
- `components/` — Lit-based web components

#### Root-level Modules
- `routing.ts` — URL routing
- `trainboard.ts` — Main application logic and orchestration

### Imports

- Use ES module syntax: `import { foo } from './bar'`
- Import types with type-only imports when possible: `import type { Foo } from './types'`
- Organize imports: external packages first, then local modules

## Testing Guidelines

### Writing Tests

- Place tests in `src/__tests__/` directory
- Name test files: `<module>.test.ts`
- Use Vitest's `describe`, `test`/`it`, `expect` API
- Test edge cases and error conditions
- Mock external dependencies when appropriate

### Running Tests

```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
```

## Vite Development

### Dev Server

- Default port: 5173
- Supports HMR for instant updates
- Serves `index.html` as entry point
- TypeScript files are transpiled on-the-fly

### Build Configuration

- Output: `dist/` directory
- Base path: `'./'` (relative paths)
- Minification: enabled in production
- Source maps: generated for debugging

## Code Style

### Formatting

- Run Prettier before committing: `npm run format`
- Configuration: `.prettierrc`
- Applies to TypeScript files in `src/`

### Naming Conventions

- Variables/functions: camelCase
- Types/interfaces: PascalCase
- Constants: UPPER_SNAKE_CASE (for config values)
- Files: lowercase with hyphens or single words

### Comments

- Use JSDoc for public API functions
- Add inline comments for complex logic
- Avoid obvious comments
- Keep comments up-to-date with code changes

## Common Patterns

### API Calls

```typescript
// Use the API client from src/odpt/api.ts
import { fetchTrainData } from '../odpt/api';

const data = await fetchTrainData(apiKey, station);
```

### Caching

```typescript
// Use SimpleCache from src/lib/cache.ts
import { SimpleCache } from '../lib/cache';

const cache = new SimpleCache<string, StationData>(ttl);
cache.set(key, value);
const value = cache.get(key);
```

### UI Updates

```typescript
// Use rendering functions from src/ui/renderBoard.ts
import { renderBoard } from '../ui/renderBoard';

renderBoard(container, config);
```

### Interval Management

```typescript
// Use tickManager from src/lib/tickManager.ts
import { TickManager } from '../lib/tickManager';

const tickManager = new TickManager(callback, intervalMs);
tickManager.start();
```

### URL Routing

```typescript
// Use routing functions from src/routing.ts
import { parseRouteFromUrl, updateUrl, findRailwayByName, findStationByName } from '../routing';

// Parse URL parameters
const params = parseRouteFromUrl();
const railway = findRailwayByName(railways, params.railwayName);
const station = findStationByName(stations, params.stationName);

// Update URL when selection changes
updateUrl(railwayName, stationName);
```

### Geolocation

```typescript
// Use location functions from src/lib/location.ts
import { getCurrentPosition, findNearbyStations, formatDistance } from '../lib/location';

// Get user location and find nearby stations
const position = await getCurrentPosition();
const nearby = findNearbyStations(position.coords.latitude, position.coords.longitude);
```

## Error Handling

### API Errors

- Display user-friendly error messages
- Log errors to console for debugging
- Show settings modal on authentication errors
- Handle network failures gracefully

### Type Errors

- Validate API responses
- Use type guards for runtime checks
- Handle missing or malformed data
- Provide sensible defaults

## Performance

### Optimization

- Use caching to reduce API calls
- Batch station metadata lookups
- Minimize DOM updates
- Use Vite's code splitting when appropriate

### Build Size

- Keep bundle size small
- Avoid unnecessary dependencies
- Use tree-shaking friendly imports
- Monitor `dist/` size after changes

## Debugging

### Browser DevTools

- Check console for errors
- Use Network tab for API debugging
- Inspect localStorage for cached data
- Use Source maps for debugging

### Common Issues

- API key not set: Check `defaults.json` or localStorage
- CORS errors: Use proper ODPT endpoint
- Build failures: Check TypeScript errors
- Test failures: Verify test data and mocks

## Git Workflow

### Commits

- Make small, focused commits
- Write clear commit messages
- Don't commit `dist/` (it's built by CI)
- Don't commit `node_modules/`
- Defaults: `defaults.json` is committed and contains non-secret defaults. Do NOT commit private API keys there.

### Files to Ignore

- `dist/` (generated by build)
- `node_modules/` (installed by npm)
- `defaults.json` (contains non-secret defaults; do not store private API keys)
- `.DS_Store` (macOS)
- IDE-specific files (unless in .gitignore)
