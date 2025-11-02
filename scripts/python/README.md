# Python Scripts for ODPT Data Fetching

This directory contains Python scripts for fetching data from the ODPT API.

## Requirements

- Python 3.6 or higher
- No external dependencies (uses only Python standard library)

## Scripts

### fetch_stations.py

Fetches all stations from the ODPT API by:
1. Fetching all operators from `odpt:Operator` endpoint
2. For each operator, fetching all railways from `odpt:Railway` endpoint
3. For each railway, fetching all stations from `odpt:Station` endpoint

#### Usage

With API key as argument:
```bash
python fetch_stations.py YOUR_API_KEY
```

With API key from config.json:
```bash
# First create config.json in the repository root (see config.example.json)
python fetch_stations.py
```

Save output to file:
```bash
python fetch_stations.py YOUR_API_KEY --output stations.json
```

Pretty-print JSON output:
```bash
python fetch_stations.py YOUR_API_KEY --pretty
```

Custom API base URL:
```bash
python fetch_stations.py YOUR_API_KEY --base-url https://api.odpt.org/api/v4/
```

#### Output Format

The script outputs JSON with the following structure:

```json
{
  "summary": {
    "operators": 50,
    "railways": 200,
    "stations": 5000
  },
  "stations": [
    {
      "@id": "...",
      "@type": "odpt:Station",
      "dc:title": "東京",
      "odpt:stationTitle": {
        "ja": "東京",
        "en": "Tokyo"
      },
      "owl:sameAs": "odpt.Station:JR-East.ChuoRapid.Tokyo",
      "odpt:railway": "odpt.Railway:JR-East.ChuoRapid",
      "odpt:stationCode": "JC01",
      ...
    },
    ...
  ]
}
```

#### Exit Codes

- 0: Success
- 1: Error (API error, missing API key, etc.)
- 130: Interrupted by user (Ctrl+C)

## API Key

You can provide the API key in two ways:

1. As a command-line argument: `python fetch_stations.py YOUR_API_KEY`
2. In a `config.json` file in the repository root:

```json
{
  "ODPT_API_KEY": "YOUR_KEY_HERE",
  "API_BASE_URL": "https://api-challenge.odpt.org/api/v4/"
}
```

To get an API key, sign up at [ODPT Developer Portal](https://developer.odpt.org/).

## Notes

- The script uses only Python standard library, no external dependencies required
- Duplicate stations (appearing in multiple railways) are automatically deduplicated
- Progress messages are printed to stderr, JSON output goes to stdout
- The script handles errors gracefully and provides informative error messages
