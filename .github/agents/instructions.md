# GitHub Agent Instructions for Trainboard

## Project Overview

Trainboard is a compact static departure board for ODPT train lines. It's a TypeScript-powered static web application that queries ODPT endpoints and displays upcoming departures for any train line supported by the ODPT API.

## Tech Stack

- **Language**: TypeScript
- **Build Tool**: Vite 7.x
- **Testing**: Vitest
- **Formatting**: Prettier
- **Deployment**: GitHub Pages (via GitHub Actions)
- **Package Manager**: npm

## Project Structure

```
trainboard/
├── src/
│   ├── lib/
│   │   ├── cache.ts            # SimpleCache implementation
│   │   ├── config.ts           # Configuration management
│   │   ├── constants.ts        # Application constants
│   │   ├── location.ts         # Geolocation and nearby station finding
│   │   ├── tickManager.ts      # Interval management for refresh scheduling
│   │   ├── utils.ts            # Utility functions
│   │   ├── visibilityManager.ts # Page Visibility API integration
│   │   └── data/
│   │       └── stations.json   # Station metadata
│   ├── odpt/
│   │   ├── api.ts              # ODPT API client
│   │   ├── dataLoaders.ts      # Data loading and caching
│   │   ├── types.ts            # TypeScript type definitions for ODPT
│   │   └── data/
│   │       ├── holidays.json   # Holiday data
│   │       └── terminus.json   # Terminus station data
│   ├── ui/
│   │   ├── components/         # Lit-based web components
│   │   │   ├── DeparturesList.ts      # Departure list component
│   │   │   ├── HeaderButton.ts        # Header button component
│   │   │   ├── StationHeader.ts       # Station header component
│   │   │   ├── TimerContext.ts        # Timer context for components
│   │   │   ├── TrainDepartureView.ts  # Train departure view component
│   │   │   └── TrainRow.ts            # Train row component
│   │   ├── departures.ts       # Departure-related UI utilities
│   │   ├── renderBoard.ts      # Departure board rendering
│   │   ├── settings.ts         # Settings modal and UI controls
│   │   ├── trainTypeRewrites.ts # Train type name rewrites
│   │   ├── trainTypeStyles.ts  # Train type styling
│   │   └── data/               # UI data files (operators, prefectures, colors, etc.)
│   ├── routing.ts              # URL routing for railway/station selection
│   ├── trainboard.ts           # Main application logic and orchestration
│   └── __tests__/              # Vitest test files
│       ├── api.test.ts
│       ├── api_query.test.ts
│       ├── boardRendererVisibility.test.ts
│       ├── departureListVisibility.test.ts
│       ├── holidays.test.ts
│       ├── location.test.ts
│       ├── minutes_updater.test.ts
│       ├── parsing.test.ts
│       ├── rendering.test.ts
│       ├── routing.test.ts
│       ├── tickManager.test.ts
│       ├── tickManagerVisibility.test.ts
│       ├── trainrow.test.ts
│       ├── ui.test.ts
│       ├── visibilityIntegration.test.ts
│       └── visibilityManager.test.ts
├── css/                # Stylesheets
├── dist/               # Production build output (generated)
├── index.html          # Main HTML entry point
├── vite.config.ts      # Vite configuration
└── tsconfig.json       # TypeScript configuration
```

## Development Workflow

### Setup

```bash
npm install
```

### Development Server

```bash
npm run dev
# Opens Vite dev server at http://localhost:5173 with HMR
```

### Build

```bash
npm run build
# Outputs to dist/ directory with relative paths for GitHub Pages
```

### Testing

```bash
npm test           # Run tests with Vitest
npm run typecheck  # Run TypeScript type checking
```

### Formatting

```bash
npm run format
# Formats TypeScript files in src/ using Prettier
```

### Deployment

- **Local**: `npm run deploy` (uses gh-pages package)
- **CI**: Automatic deployment via `.github/workflows/deploy.yml` on push to `main`

## Code Guidelines

### TypeScript

- Use strict type checking (enabled in tsconfig.json)
- Define types in `types.ts` for shared interfaces
- Use ES modules (`import`/`export`)
- Avoid `any` types when possible

### Code Style

- Use Prettier for formatting (configured in `.prettierrc`)
- Follow existing code patterns in the repository
- Use meaningful variable and function names
- Add JSDoc comments for complex functions

### Testing

- Write tests using Vitest
- Place tests in `src/__tests__/` directory
- Test file naming: `*.test.ts`
- Focus on testing utility functions and parsing logic

### Modules

The codebase is organized into logical subdirectories:

#### src/lib/
Core utilities and shared functionality:
- `cache.ts` — SimpleCache implementation for caching data with TTL
- `config.ts` — Configuration management and API key handling
- `constants.ts` — Application-wide constants
- `location.ts` — Geolocation utilities for finding nearby stations
- `tickManager.ts` — Interval management for scheduled refresh operations
- `utils.ts` — Pure utility functions for parsing and formatting
- `visibilityManager.ts` — Page Visibility API integration for CPU optimization

#### src/odpt/
ODPT API integration:
- `api.ts` — ODPT API client for fetching train data
- `dataLoaders.ts` — Data loading, caching, and railway metadata management
- `types.ts` — TypeScript type definitions for ODPT data structures

#### src/ui/
UI rendering and components:
- `renderBoard.ts` — Main departure board rendering logic
- `settings.ts` — Settings modal and UI control setup
- `departures.ts` — Departure-related UI utilities
- `trainTypeRewrites.ts` — Train type name rewrites
- `trainTypeStyles.ts` — Train type styling and CSS injection
- `components/` — Lit-based web components:
  - `DeparturesList.ts` — Departure list component
  - `HeaderButton.ts` — Header button component
  - `StationHeader.ts` — Station header component
  - `TimerContext.ts` — Timer context for component synchronization
  - `TrainDepartureView.ts` — Train departure view component
  - `TrainRow.ts` — Individual train row component

#### Root modules
- `routing.ts` — URL routing for railway/station selection with flexible name matching
- `trainboard.ts` — Main application entry point and orchestration

## Configuration

### API Key

The app requires an ODPT API key:

1. Static defaults: Edit `defaults.json` (see `scripts/cloudflare/config.example.json` for an example)
2. Dynamic: Use the settings modal in the UI (stored in localStorage)

### Vite Configuration

- Base path: `'./'` (relative paths for GitHub Pages)
- Build output: `dist/`
- Entry point: `index.html`

## CI/CD

### GitHub Actions Workflow

- Triggers: Push to `main` branch
- Jobs: Install dependencies → Build → Deploy to GitHub Pages
- Uses: Node.js 22, peaceiris/actions-gh-pages@v3
- Permissions: `contents: write` for deployment

## Common Tasks

### Adding New Features

1. Create/modify TypeScript files in `src/`
2. Update types in `types.ts` if needed
3. Add tests in `src/__tests__/`
4. Run `npm run typecheck` and `npm test`
5. Format with `npm run format`
6. Test locally with `npm run dev`
7. Build with `npm run build` before committing

### Fixing Bugs

1. Identify the affected module
2. Add a test case that reproduces the bug
3. Fix the bug
4. Verify tests pass
5. Ensure types are correct with `npm run typecheck`

### Updating Dependencies

1. Update `package.json`
2. Run `npm install`
3. Test thoroughly with `npm test` and `npm run build`
4. Update documentation if the API changes

## Important Notes

- The app is designed for GitHub Pages deployment
- All paths in the build are relative (Vite `base: './'`)
- API key is required for ODPT endpoints
- The default station is "武蔵小杉 (TY11)" (Musashi-Kosugi)
- Uses the ODPT Challenge 2025 API endpoint
- No backend required - fully static frontend

## External Dependencies

- ODPT API: https://developer.odpt.org/
- Requires developer account for API access
- Challenge 2025 endpoint: https://api-challenge.odpt.org/api/v4/

## Making Changes

- Always run tests before committing: `npm test`
- Always run type checking: `npm run typecheck`
- Format code before committing: `npm run format`
- Test the build: `npm run build`
- Verify the dev server works: `npm run dev`
- Keep changes minimal and focused
- Follow the existing code structure and patterns
