# Trainboard

A compact static departure board for the Tokyu Toyoko Line.

Files
- `trainboard.html` — main HTML page
- `trainboard.js` — extracted JavaScript logic (fetches ODPT data)
- `trainboard.css` — extracted styles

Quick run (two options)

1) Python built-in HTTP server (no install required):

```bash
cd /workspaces/trainboard
python3 -m http.server 8000
# open http://localhost:8000/trainboard.html
```

2) Using `http-server` (npm)

```bash
cd /workspaces/trainboard
# if you haven't installed http-server locally
npm install
npm start
# open http://localhost:8080/trainboard.html (see package.json)
```

Notes
- The ODPT API key is in `trainboard.js` as `ODPT_API_KEY`. Replace it with your own key or change the code to load from an external config.
- The page uses `defer` to load `trainboard.js` and expects the files to be served over HTTP (some browsers block fetch from file://).

Config
- Copy `config.example.json` to `config.json` and replace `YOUR_KEY_HERE` with your actual ODPT API key.
- `config.json` is included in `.gitignore` to avoid committing secrets. Example contents:

```json
{
	"ODPT_API_KEY": "YOUR_KEY_HERE"
}
```

TypeScript build
----------------

This repo includes a TypeScript source at `src/trainboard.ts`. To build it:

```bash
npm install
npm run build
```

The compiled JavaScript will be emitted to `dist/` and `trainboard.html` is already set to load the built file. During development you can run the static server (after building):

```bash
npm start
# open http://localhost:8080/trainboard.html
```

Vite development (recommended)
------------------------------

I added a Vite workflow for fast TypeScript edit/refresh cycles.

1. Install dev dependencies:

```bash
npm install
```

2. Start the Vite dev server:

```bash
npm run dev
```

3. Open the URL printed by Vite (usually http://localhost:5173). Edit `src/trainboard.ts` and Vite will HMR/refresh the page instantly.

Notes:
- During dev the entry page is `index.html` which imports `/src/trainboard.ts` as an ES module (Vite handles TS).
- `config.json` is served as a static asset at `http://localhost:5173/config.json` so the runtime fetch in the app will work without changes.

Formatting / editor setup
-------------------------

This project uses Prettier with a 100-character line width. Files added:

- `.prettierrc` — Prettier config (printWidth: 100)
- `.editorconfig` — editor defaults (max_line_length = 100)
- `.vscode/settings.json` — optional VS Code recommended settings (formatOnSave, ruler at 100)

To format all source files:

```bash
npm install
npm run format
```

In VS Code: install the 'Prettier - Code formatter' extension by Esben Petersen, then enable Format On Save (the workspace settings here already enable it). That will autoformat TypeScript files to the configured 100-character width on save.

Next steps
- Consider moving the API key out of source control.
- Add automated tests or CI to validate build artifacts.
