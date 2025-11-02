#!/usr/bin/env python3
"""
Fetch all stations from ODPT API.

This script fetches all operators, then all railways for each operator,
and finally all stations for each railway.

Usage:
    python fetch_stations.py [API_KEY]

If API_KEY is not provided, the script will try to read it from defaults.json
in the repository root.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urlencode
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError


# Constants
MAX_PARENT_DIRS = 5  # Maximum number of parent directories to search for defaults.json
REQUEST_TIMEOUT = 30  # Timeout in seconds for API requests


class OdptClient:
    """Client for ODPT API."""

    def __init__(self, api_key: str, base_url: str = "https://api-challenge.odpt.org/api/v4/"):
        """
        Initialize ODPT client.

        Args:
            api_key: ODPT API key
            base_url: Base URL for ODPT API
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip('/') + '/'

    def _make_request(self, endpoint: str, params: Optional[Dict] = None) -> List[Dict]:
        """
        Make a request to ODPT API.

        Args:
            endpoint: API endpoint (e.g., 'odpt:Operator')
            params: Additional query parameters

        Returns:
            List of results from API

        Raises:
            HTTPError: If API request fails
        """
        query_params = {'acl:consumerKey': self.api_key}
        if params:
            query_params.update(params)

        url = f"{self.base_url}{endpoint}?{urlencode(query_params)}"
        print('Requesting URL:', url, file=sys.stderr)

        try:
            req = Request(url)
            with urlopen(req, timeout=REQUEST_TIMEOUT) as response:
                data = response.read()
                return json.loads(data.decode('utf-8'))
        except HTTPError as e:
            # Redact API key from URL in error messages for security
            safe_url = url.replace(self.api_key, '<API_KEY_REDACTED>')
            print(f"HTTP Error {e.code}: {e.reason}", file=sys.stderr)
            print(f"URL: {safe_url}", file=sys.stderr)
            raise
        except URLError as e:
            print(f"URL Error: {e.reason}", file=sys.stderr)
            raise

    def fetch_operators(self) -> List[Dict]:
        """
        Fetch all operators.

        Returns:
            List of operator objects
        """
        print("Fetching operators...", file=sys.stderr)
        operators = self._make_request('odpt:Operator')
        print(f"Found {len(operators)} operators", file=sys.stderr)
        return operators

    def fetch_railways(self, operator_id: Optional[str] = None) -> List[Dict]:
        """
        Fetch railways, optionally filtered by operator.

        Args:
            operator_id: Optional operator ID to filter by

        Returns:
            List of railway objects
        """
        params = {}
        if operator_id:
            params['odpt:operator'] = operator_id
            print(f"Fetching railways for operator {operator_id}...", file=sys.stderr)
        else:
            print("Fetching all railways...", file=sys.stderr)

        railways = self._make_request('odpt:Railway', params)
        print(f"Found {len(railways)} railways", file=sys.stderr)
        return railways

    def fetch_stations(self, railway_id: Optional[str] = None) -> List[Dict]:
        """
        Fetch stations, optionally filtered by railway.

        Args:
            railway_id: Optional railway ID to filter by

        Returns:
            List of station objects
        """
        params = {}
        if railway_id:
            params['odpt:railway'] = railway_id

        stations = self._make_request('odpt:Station', params)
        return stations


def find_config_file() -> Optional[Path]:
    """
    Find defaults.json in repository root.

    Returns:
        Path to defaults.json if found, None otherwise
    """
    # Start from script directory and go up to find defaults.json
    current_dir = Path(__file__).resolve().parent

    # Go up directories to find defaults.json
    for _ in range(MAX_PARENT_DIRS):
        config_path = current_dir / 'defaults.json'
        if config_path.exists():
            return config_path
        current_dir = current_dir.parent

    return None


def read_api_key_from_config() -> Optional[str]:
    """
    Read API key from defaults.json.

    Returns:
        API key if found, None otherwise
    """
    config_path = find_config_file()

    if config_path is None:
        return None

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
            return config.get('ODPT_API_KEY')
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error reading config file: {e}", file=sys.stderr)
        return None


def read_operators_file(path: Optional[Path] = None) -> List[str]:
    """
    Read operator IDs from an operators.txt file.

    Each non-empty, non-comment line should contain an operator ID like
    'odpt.Operator:JR-East'. Returns a list of operator ID strings.
    """
    if path is None:
        path = Path(__file__).resolve().parent / 'operators.txt'

    if not path.exists():
        print(f"Operators file not found at {path}", file=sys.stderr)
        return []

    operators: List[str] = []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                operators.append(line)
    except (IOError, OSError) as e:
        print(f"Error reading operators file: {e}", file=sys.stderr)

    return operators


def main():
    """Main function."""
    parser = argparse.ArgumentParser(
        description='Fetch all stations from ODPT API'
    )
    parser.add_argument(
        'api_key',
        nargs='?',
        help='ODPT API key (optional if defaults.json exists)'
    )
    parser.add_argument(
        '--base-url',
        default='https://api-challenge.odpt.org/api/v4/',
        help='Base URL for ODPT API (default: https://api-challenge.odpt.org/api/v4/)'
    )
    parser.add_argument(
        '--output',
        '-o',
        help='Output file (default: stdout)'
    )
    parser.add_argument(
        '--pretty',
        action='store_true',
        help='Pretty-print JSON output'
    )
    parser.add_argument(
        '--geojson',
        action='store_true',
        help='Write output as a GeoJSON FeatureCollection (requires stations to have coordinates)'
    )

    args = parser.parse_args()

    # Get API key
    api_key = args.api_key
    if not api_key:
        api_key = read_api_key_from_config()

    if not api_key:
        print("Error: No API key provided and defaults.json not found", file=sys.stderr)
        print("Usage: python fetch_stations.py [API_KEY]", file=sys.stderr)
        sys.exit(1)

    # Create client
    client = OdptClient(api_key, args.base_url)

    try:
        # Load operators from local operators.txt instead of calling the API
        operators = read_operators_file()
        if not operators:
            print("No operators found in operators.txt; aborting.", file=sys.stderr)
            sys.exit(1)

        # Collect all stations
        all_stations = []
        railway_count = 0

        # For each operator ID, fetch railways and then stations
        for operator_id in operators:
            if not operator_id:
                continue

            print(f"Processing operator: {operator_id}", file=sys.stderr)

            # Fetch railways for this operator
            railways = client.fetch_railways(operator_id)
            railway_count += len(railways)

            # For each railway, fetch stations
            for railway in railways:
                railway_id = railway.get('owl:sameAs')
                if not railway_id:
                    continue

                railway_title = railway.get('dc:title', railway_id)
                print(f"Fetching stations for railway: {railway_title}", file=sys.stderr)

                stations = client.fetch_stations(railway_id)
                print(f"  Found {len(stations)} stations", file=sys.stderr)

                # Add railway info to each station for context
                for station in stations:
                    if 'odpt:railway' not in station:
                        station['odpt:railway'] = railway_id

                all_stations.extend(stations)

        # Remove duplicates (some stations may appear in multiple railways)
        unique_stations = {}
        for station in all_stations:
            station_id = station.get('owl:sameAs')
            if station_id:
                unique_stations[station_id] = station

        stations_list = list(unique_stations.values())

        # Sort by station ID for consistent output
        stations_list.sort(key=lambda s: s.get('owl:sameAs', ''))

        # Print summary to stderr
        print("\n=== Summary ===", file=sys.stderr)
        print(f"Operators: {len(operators)}", file=sys.stderr)
        print(f"Railways: {railway_count}", file=sys.stderr)
        print(f"Total stations (with duplicates): {len(all_stations)}", file=sys.stderr)
        print(f"Unique stations: {len(stations_list)}", file=sys.stderr)

        # Output results
        indent = 2 if args.pretty else None

        if args.geojson or (args.output and args.output.lower().endswith('.geojson')):
            # Convert stations to GeoJSON FeatureCollection
            features = []
            skipped = 0
            for station in stations_list:
                # Only include the requested properties
                properties = {
                    'owl:sameAs': station.get('owl:sameAs'),
                    'odpt:stationTitle': station.get('odpt:stationTitle'),
                    'odpt:operator': station.get('odpt:operator'),
                    'odpt:railway': station.get('odpt:railway')
                }

                # Try common coordinate fields used by ODPT
                lat = None
                lon = None
                for k in ('geo:lat', 'lat', 'latitude'):
                    if k in station:
                        lat = station.get(k)
                        break
                for k in ('geo:long', 'long', 'lon', 'longitude'):
                    if k in station:
                        lon = station.get(k)
                        break

                # Convert to floats if possible
                try:
                    if lat is not None and lon is not None:
                        lat_f = float(lat)
                        lon_f = float(lon)
                        geometry = {
                            'type': 'Point',
                            'coordinates': [lon_f, lat_f]
                        }
                    else:
                        geometry = None
                except (ValueError, TypeError):
                    geometry = None

                if geometry is None:
                    skipped += 1
                    # Skip stations without usable coordinates
                    continue

                feature = {
                    'type': 'Feature',
                    'geometry': geometry,
                    'properties': properties
                }
                features.append(feature)

            geojson = {
                'type': 'FeatureCollection',
                'features': features
            }

            if args.output:
                with open(args.output, 'w', encoding='utf-8') as f:
                    json.dump(geojson, f, ensure_ascii=False, indent=indent)
                print(f"\nGeoJSON written to {args.output} (features: {len(features)}, skipped: {skipped})", file=sys.stderr)
            else:
                print(json.dumps(geojson, ensure_ascii=False, indent=indent))

        else:
            output_data = {
                'summary': {
                    'operators': len(operators),
                    'railways': railway_count,
                    'stations': len(stations_list)
                },
                'stations': stations_list
            }

            json_output = json.dumps(output_data, ensure_ascii=False, indent=indent)

            if args.output:
                with open(args.output, 'w', encoding='utf-8') as f:
                    f.write(json_output)
                print(f"\nOutput written to {args.output}", file=sys.stderr)
            else:
                print(json_output)

    except HTTPError as e:
        print(f"\nFailed to fetch data from API", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\nInterrupted by user", file=sys.stderr)
        sys.exit(130)
    except Exception as e:
        print(f"\nUnexpected error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
