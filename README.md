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

Next steps
- Consider moving the API key out of source control.
- Add automated tests or CI to validate build artifacts.
