// src/types.ts
// Minimal TypeScript interfaces for ODPT responses used by the client.

export interface OdptStation {
  '@context'?: string;
  '@id'?: string;
  '@type'?: string;
  'owl:sameAs'?: string;
  'dc:title'?: string | { ja?: string; en?: string };
  'odpt:stationTitle'?: { ja?: string; en?: string } | string;
  'odpt:stationCode'?: string;
  [key: string]: unknown;
}

export interface StationTimetableEntry {
  'odpt:departureTime'?: string;
  'odpt:arrivalTime'?: string;
  'odpt:destinationStation'?: Array<string | { 'dc:title'?: string; 'owl:sameAs'?: string }>;
  'odpt:trainType'?: string;
  'odpt:railDirection'?: string;
  'odpt:trainNumber'?: string;
  [key: string]: unknown;
}

export interface OdptStationTimetable {
  '@id'?: string;
  '@type'?: string;
  'owl:sameAs'?: string;
  'odpt:station'?: string;
  'odpt:calendar'?: string;
  'odpt:stationTimetableObject'?: StationTimetableEntry[];
  [key: string]: unknown;
}

export interface OdptTrainInformation {
  '@id'?: string;
  '@type'?: string;
  'odpt:railway'?: string;
  'odpt:trainInformationText'?: string | { ja?: string; en?: string };
  [key: string]: unknown;
}

export interface OdptRailway {
  '@id'?: string;
  '@type'?: string;
  'owl:sameAs'?: string;
  'dc:title'?: string | { ja?: string; en?: string };
  'odpt:railwayTitle'?: { ja?: string; en?: string } | string;
  'odpt:operator'?: string;
  'odpt:lineCode'?: string;
  'odpt:ascendingRailDirection'?: string;
  'odpt:descendingRailDirection'?: string;
  [key: string]: unknown;
}

export interface OdptRailDirection {
  '@id'?: string;
  '@type'?: string;
  'owl:sameAs'?: string;
  'dc:title'?: string | { ja?: string; en?: string };
  [key: string]: unknown;
}

export interface OdptTrainType {
  '@id'?: string;
  '@type'?: string;
  'owl:sameAs'?: string;
  'dc:title'?: string | { ja?: string; en?: string };
  'odpt:operator'?: string;
  [key: string]: unknown;
}
