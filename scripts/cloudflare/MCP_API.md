# MCP Server Layer - ODPT Train Data Endpoints

This document describes the MCP (Model Context Protocol) server layer added to the Cloudflare Worker for accessing ODPT train data.

## Overview

The MCP server layer provides structured, discoverable access to ODPT train data through standardized endpoints. This enables AI/LLM applications to query train information using the Model Context Protocol.

## Endpoints

### 1. List Available Resources

**Endpoint:** `GET /mcp/resources/list`

Returns a list of all available ODPT train data resources.

**Example Request:**

```bash
curl https://your-worker.workers.dev/mcp/resources/list
```

**Example Response:**

```json
{
  "resources": [
    {
      "uri": "odpt://PassengerSurvey",
      "name": "odpt:PassengerSurvey",
      "description": "Passenger survey data for railway lines and stations",
      "mimeType": "application/json"
    },
    {
      "uri": "odpt://Railway",
      "name": "odpt:Railway",
      "description": "Railway line metadata including operators, stations, and line codes",
      "mimeType": "application/json"
    }
    // ... 8 more resources
  ]
}
```

### 2. Get Resource Data

**Endpoint:** `GET /mcp/resources/get?uri=<resource-uri>&<filters>`

Retrieves data from a specific ODPT resource with optional filtering.

**Parameters:**

- `uri` (required): The resource URI (e.g., `odpt://Station`)
- Additional ODPT query parameters (e.g., `odpt:railway`, `odpt:station`)

**Example Requests:**

Get all stations on the Tokyu Toyoko line:

```bash
curl "https://your-worker.workers.dev/mcp/resources/get?uri=odpt://Station&odpt:railway=odpt.Railway:Tokyu.Toyoko"
```

Get station timetable:

```bash
curl "https://your-worker.workers.dev/mcp/resources/get?uri=odpt://StationTimetable&odpt:station=odpt.Station:Tokyu.Toyoko.MusashiKosugi"
```

Get real-time trains:

```bash
curl "https://your-worker.workers.dev/mcp/resources/get?uri=odpt://Train&odpt:railway=odpt.Railway:Tokyu.Toyoko"
```

**Error Response (Missing URI):**

```json
{
  "error": "Missing resource URI",
  "message": "Please provide a \"uri\" query parameter",
  "example": "/mcp/resources/get?uri=odpt://Station&odpt:railway=odpt.Railway:Tokyu.Toyoko"
}
```

**Error Response (Resource Not Found):**

```json
{
  "error": "Resource not found",
  "message": "Resource with URI \"odpt://InvalidResource\" not found",
  "availableResources": [
    "odpt://PassengerSurvey",
    "odpt://Railway"
    // ... all available resources
  ]
}
```

### 3. List Available Tools

**Endpoint:** `GET /mcp/tools/list`

Returns available MCP tools for querying ODPT data.

**Example Request:**

```bash
curl https://your-worker.workers.dev/mcp/tools/list
```

**Example Response:**

```json
{
  "tools": [
    {
      "name": "query_odpt_resource",
      "description": "Query ODPT train data resources with filtering parameters",
      "inputSchema": {
        "type": "object",
        "properties": {
          "resource": {
            "type": "string",
            "description": "The ODPT resource to query",
            "enum": [
              "odpt:PassengerSurvey",
              "odpt:Railway",
              "odpt:RailDirection",
              "odpt:RailwayFare",
              "odpt:Station",
              "odpt:StationTimetable",
              "odpt:Train",
              "odpt:TrainInformation",
              "odpt:TrainTimetable",
              "odpt:TrainType"
            ]
          },
          "filters": {
            "type": "object",
            "description": "Query filters (e.g., odpt:railway, odpt:station)",
            "additionalProperties": true
          }
        },
        "required": ["resource"]
      }
    }
  ]
}
```

## Available Resources

| URI                       | Name                    | Description                                                          |
| ------------------------- | ----------------------- | -------------------------------------------------------------------- |
| `odpt://PassengerSurvey`  | `odpt:PassengerSurvey`  | Passenger survey data for railway lines and stations                 |
| `odpt://Railway`          | `odpt:Railway`          | Railway line metadata including operators, stations, and line codes  |
| `odpt://RailDirection`    | `odpt:RailDirection`    | Rail direction information (inbound/outbound, up/down)               |
| `odpt://RailwayFare`      | `odpt:RailwayFare`      | Railway fare information between stations                            |
| `odpt://Station`          | `odpt:Station`          | Station metadata including location, codes, and railway associations |
| `odpt://StationTimetable` | `odpt:StationTimetable` | Station departure/arrival timetables by calendar and direction       |
| `odpt://Train`            | `odpt:Train`            | Real-time train position and status information                      |
| `odpt://TrainInformation` | `odpt:TrainInformation` | Railway operation status and service disruption messages             |
| `odpt://TrainTimetable`   | `odpt:TrainTimetable`   | Train-level timetables with scheduled stops and times                |
| `odpt://TrainType`        | `odpt:TrainType`        | Train type classifications (express, local, limited express, etc.)   |

## Features

- **Resource Discovery**: List all available resources via `/mcp/resources/list`
- **Structured Querying**: Use URI-based resource access with filtering
- **Tool Definition**: Expose query capabilities through MCP tools schema
- **Caching**: Leverages existing Cloudflare cache infrastructure
- **Error Handling**: Helpful error messages with examples
- **Backward Compatible**: Existing ODPT proxy endpoints (`/odpt:*`) continue to work

## Integration with AI/LLM

The MCP endpoints enable AI applications to:

1. **Discover** available train data resources
2. **Query** specific data with filters
3. **Integrate** train information into conversational interfaces
4. **Build** context-aware transportation assistants

Example AI use cases:

- "What trains are running on the Tokyu Toyoko line?"
- "Show me the timetable for Musashi-Kosugi station"
- "Are there any delays on the Yamanote line?"
- "Find the nearest station to my current location"

## HTTP Methods

- **GET**: All MCP endpoints support GET requests
- **POST**: MCP endpoints also support POST for compatibility with MCP clients
- **OPTIONS**: CORS preflight support

## Response Format

All MCP endpoints return JSON with appropriate CORS headers for browser compatibility.

## Error Handling

The MCP layer provides clear error messages:

- 400: Missing or invalid parameters
- 404: Resource not found
- 405: Method not allowed
- 500: Internal server error

## Caching

MCP resource queries use the same caching strategy as ODPT proxy endpoints:

- Static data (Station, Railway): 1 hour TTL
- Real-time data (Train, TrainInformation): 5 minutes TTL

## Notes

- The MCP layer is a thin wrapper around the ODPT API
- All ODPT query parameters are passed through to the API
- The worker securely stores and injects the ODPT API key
- No API key exposure to clients

## Example: Building an MCP Client

```javascript
// Discover available resources
const resources = await fetch('https://your-worker.workers.dev/mcp/resources/list').then((r) =>
  r.json(),
);

console.log(
  'Available resources:',
  resources.resources.map((r) => r.name),
);

// Query a specific resource
const stations = await fetch(
  'https://your-worker.workers.dev/mcp/resources/get?' +
    'uri=odpt://Station&odpt:railway=odpt.Railway:Tokyu.Toyoko',
).then((r) => r.json());

console.log('Stations on Tokyu Toyoko line:', stations);
```

## See Also

- [Model Context Protocol Specification](https://modelcontextprotocol.io/specification)
- [ODPT API Documentation](https://developer.odpt.org/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
