# ODPT Train API — Human & Agent Reference

This expanded reference distills the ODPT Train-related API surfaces and dependencies into a complete guide for implementers and coding agents. It includes endpoint summaries, detailed response field descriptions, TypeScript interface samples, filtering and calendar handling, parsing and robustness tips, example requests/responses, and integration best practices.

Source: ODPT API Specification v4.x (JSON-LD). This doc extracts the train-related portions; refer to the official spec for any changes.

Overview
--------

- Base URL: https://api.odpt.org/api/v4
- Transport: HTTPS, MIME type: application/json (JSON-LD)
- Authentication: always supply acl:consumerKey as a query parameter
- Return shape: an Array of JSON-LD objects for each endpoint (even for single results)

Common notes
------------

- All parameters must be URI encoded when necessary (e.g., Japanese characters).
- Many fields are URIs (owl:sameAs, odpt:railway, odpt:trainType). Map these to human labels using the appropriate vocabulary endpoints (e.g., odpt:TrainType, odpt:Railway, odpt:Station).
- Language-aware fields: some properties are language maps (objects with keys like `ja` and `en`) while others are plain strings. Use a helper to prefer `ja` then `en` then fallback.
- Empty results return `[]`. Missing properties are common — code defensively.

Auth & errors
-------------

- Authentication: include `acl:consumerKey=YOUR_KEY` on every request.
- Common HTTP status codes: 200 OK, 400 Bad Request, 401 Unauthorized (bad key), 403 Forbidden, 404 Not Found, 500 Server Error, 503 Service Unavailable.

Filtering
---------

- Filtering uses query parameters that match property names. For nested object properties use dot notation (e.g., `odpt:stationTitle.en=Tokyo`).
- For array properties of primitive values (strings/numbers), `property=value` means the value is included in at least one element of the array.
- For OR searches, separate multiple values with a comma: `dc:title=東京,五反田`.

Calendar & Timetable notes
--------------------------

- Timetables are tied to `odpt:calendar` (weekday/holiday). Use `odpt.Calendar:Weekday` or `odpt.Calendar:SaturdayHoliday` when filtering station timetables.
- The StationTimetable endpoint often returns multiple timetable objects for a station (different calendars). Select the entry where `odpt:calendar` matches today's calendar.
- Time strings are usually `HH:MM` local times (Japan JST). Convert times to minutes or ISO-local time for comparisons.

Core RDF types — fields, semantics and TypeScript interfaces
---------------------------------------------------------

Below are the commonly used RDF types in train applications. For each type I list the important fields, notes, and a compact TypeScript interface you can copy into your client.

1) odpt:Train — real-time train object
------------------------------------------------

Purpose: current train status (where applicable): train number, type, origin/destination, delays, line, direction.

Important fields (observed in spec):
- `@context`: JSON-LD context URL
- `@type`: `odpt:Train`
- `@id`: unique URN (string)
- `dc:date`: timestamp of this record (ISO8601)
- `dct:valid`: optional valid-until timestamp
- `odpt:railway`: string URI (e.g. `odpt.Railway:Tokyu.Toyoko`)
- `owl:sameAs`: train unique id (e.g. `odpt.Train:Tokyu.Toyoko.XXXX`)
- `odpt:trainNumber`: string
- `odpt:trainType`: string URI (map to human label)
- `odpt:delay`: number (minutes)
- `odpt:originStation`: array of station URIs
- `odpt:destinationStation`: array of station URIs
- `odpt:fromStation`, `odpt:toStation`: station URIs for current segment
- `odpt:railDirection`: direction URI
- `odpt:operator`: operator URI

TypeScript interface (minimal):

```ts
export interface OdptTrain {
	'@context'?: string;
	'@type': 'odpt:Train';
	'@id': string;
	'dc:date'?: string;
	'dct:valid'?: string;
	'odpt:railway'?: string;
	'owl:sameAs'?: string;
	'odpt:trainNumber'?: string;
	'odpt:trainType'?: string;
	'odpt:delay'?: number;
	'odpt:originStation'?: string[];
	'odpt:destinationStation'?: string[];
	'odpt:fromStation'?: string;
	'odpt:toStation'?: string;
	'odpt:railDirection'?: string;
	'odpt:operator'?: string;
	[key: string]: unknown;
}
```

Usage tips
- Always check for `odpt:destinationStation` being present and an array.
- Map `odpt:trainType` URIs to your UI labels via a `odpt:TrainType` lookup table.

2) odpt:Station — station metadata
------------------------------------------------

Important fields:
- `@id`, `@type` = `odpt:Station`
- `dc:title`: Japanese station name string
- `odpt:stationTitle`: object with `ja`, `en` (language map)
- `owl:sameAs`: station URI (use in queries)
- `odpt:railway`: railway URI or array of URIs
- `odpt:stationCode`: station numbering like `TY11`
- `geo:long` / `geo:lat`

TypeScript interface:

```ts
export interface OdptStation {
	'@context'?: string;
	'@id': string;
	'@type': 'odpt:Station';
	'dc:title'?: string;
	'odpt:stationTitle'?: { ja?: string; en?: string };
	'owl:sameAs'?: string;
	'odpt:railway'?: string | string[];
	'odpt:stationCode'?: string;
	'geo:long'?: number;
	'geo:lat'?: number;
}
```

3) odpt:StationTimetable — station timetable
------------------------------------------------

Important fields:
- `@id`, `@type` = `odpt:StationTimetable`
- `owl:sameAs`: timetable id (includes station / direction / calendar)
- `odpt:operator`
- `odpt:station` (station URI)
- `odpt:calendar` (calendar URI like `odpt.Calendar:Weekday`)
- `odpt:stationTimetableObject`: array of entries with:
	- `odpt:departureTime` (string `HH:MM`)
	- `odpt:arrivalTime` (optional)
	- `odpt:destinationStation` (array of station URIs)
	- `odpt:trainType` (URI)
	- `odpt:railDirection` (URI)
	- `odpt:trainNumber` (optional)

TypeScript fragment:

```ts
export interface StationTimetableEntry {
	'odpt:departureTime'?: string;
	'odpt:arrivalTime'?: string;
	'odpt:destinationStation'?: { 'dc:title'?: string }[] | string[];
	'odpt:trainType'?: string;
	'odpt:railDirection'?: string;
	'odpt:trainNumber'?: string;
}

export interface OdptStationTimetable {
	'@id': string;
	'@type': 'odpt:StationTimetable';
	'owl:sameAs'?: string;
	'odpt:station'?: string;
	'odpt:calendar'?: string;
	'odpt:stationTimetableObject'?: StationTimetableEntry[];
}
```

Practical notes
- Filter station timetables by `odpt:calendar` to pick the right schedule for the day.
- `odpt:departureTime` is local HH:MM; convert to minutes for comparisons (use helper `timeToMinutes`).

4) odpt:TrainInformation — operation status / messages
------------------------------------------------

Purpose: line-level operational messages (delays, suspensions).

Important fields:
- `odpt:trainInformationText` — often a language map or string describing status
- `odpt:railway` — the railway affected

Usage: fetch and display non-normal messages prominently; ignore typical phrases indicating normal operation (e.g., `通常運行`).

5) odpt:TrainTimetable — train-level timetable
------------------------------------------------

Purpose: per-train scheduled stops (useful for mapping a train to its station list).

Important fields: similar to StationTimetable but oriented to a train: list of station stop records (arrival/departure times with station URIs).

6) odpt:TrainType, odpt:RailDirection, odpt:Railway
------------------------------------------------

- These are small vocabularies: fetch `odpt:TrainType` to map URIs to human-readable names and CSS classes.
- `odpt:RailDirection` provides labels (`上り`/`下り`, `Inbound`/`Outbound`) — useful for UI headers.
- `odpt:Railway` contains station order, line titles, and code.

Example requests & parsing recipe
--------------------------------

Goal: render next departures for a station with live status.

Steps (robust):

1. Fetch `odpt:Station` to resolve `owl:sameAs` for the chosen station (if user enters a name).
	 - `GET /api/v4/odpt:Station?dc:title=武蔵小杉&acl:consumerKey=KEY`

2. Fetch `odpt:StationTimetable` for that station and railway:
	 - `GET /api/v4/odpt:StationTimetable?odpt:station=odpt.Station:Tokyu.Toyoko.MusashiKosugi&acl:consumerKey=KEY`
	 - Find the timetable with `odpt:calendar` matching today (Weekday/SaturdayHoliday/etc.).

3. Extract `odpt:stationTimetableObject` and build a list of upcoming departures by comparing `odpt:departureTime` with now (use minutes since midnight).

4. (Optional) Fetch `odpt:Train` for live train objects on the railway to show delays and real-time mapping:
	 - `GET /api/v4/odpt:Train?odpt:railway=odpt.Railway:Tokyu.Toyoko&acl:consumerKey=KEY`
	 - Join by `odpt:trainNumber` or `owl:sameAs` where available.

5. Fetch `odpt:TrainInformation` to surface line-wide advisories.

TypeScript helper (pattern)
---------------------------

Below is a compact helper pattern you can adapt to your client (error handling omitted for brevity):

```ts
async function fetchJson(url: string) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}

function getJapaneseText(mapOrString: any): string {
	if (!mapOrString) return 'N/A';
	if (typeof mapOrString === 'string') return mapOrString;
	return mapOrString.ja || mapOrString.en || Object.values(mapOrString)[0] || 'N/A';
}

function timeToMinutes(t: string): number {
	const [h, m] = t.split(':').map(Number);
	return h * 60 + m;
}

// Example: get station timetable entries applicable today
async function getStationTodayTimetable(stationUri: string, consumerKey: string) {
	const url = `${API_BASE_URL}odpt:StationTimetable?odpt:station=${encodeURIComponent(stationUri)}&acl:consumerKey=${consumerKey}`;
	const data = await fetchJson(url);
	// choose calendar (Weekday/SaturdayHoliday...) based on today's day
	const todayCalendar = getTodayCalendarURI();
	const tt = data.find((d: any) => d['odpt:calendar'] === todayCalendar);
	return tt?.['odpt:stationTimetableObject'] || [];
}
```

Edge cases & robustness checklist
--------------------------------

- Some properties vary in shape (string vs object). Use `typeof` guards.
- Arrays may be empty — handle gracefully.
- Timetables may not contain entries for the current calendar; fall back to nearest calendar or report no schedule.
- Network errors / rate limits: implement retry with exponential backoff and a user-visible error state.
- Never assume the API returns fields in a fixed order.

Best practices
--------------

- Cache static vocabularies (TrainType, Station metadata, Railway) locally and refresh infrequently.
- Keep the API key off source control (use `config.json` ignored by git for dev; use server-side proxy in production).
- Use server-side proxies when your API key must remain secret: the browser should not hold a production key.
- Normalize time handling: convert HH:MM to minutes since midnight for comparisons; be explicit about JST.
- Provide fallbacks in the UI for missing fields and avoid hard crashes when parsing JSON-LD.

Appendix — useful example queries
--------------------------------

- Realtime trains on a line:
	`GET /api/v4/odpt:Train?odpt:railway=odpt.Railway:Tokyu.Toyoko&acl:consumerKey=KEY`
- Station metadata for 武蔵小杉:
	`GET /api/v4/odpt:Station?dc:title=武蔵小杉&acl:consumerKey=KEY`
- Station timetable (all calendars) for a station:
	`GET /api/v4/odpt:StationTimetable?odpt:station=odpt.Station:Tokyu.Toyoko.MusashiKosugi&acl:consumerKey=KEY`

If you want, I can append complete field tables copied from the spec (per-RDF-type full property lists), or add an end-to-end TypeScript example that integrates with `src/trainboard.ts` for your app. Which would you prefer?
