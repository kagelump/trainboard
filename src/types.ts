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
  'odpt:stationOrder'?: StationLite[];
  [key: string]: unknown;
}

export interface StationLite {
  'odpt:index'?: number;
  'odpt:station'?: string;
  'odpt:stationTitle'?: { ja?: string; en?: string } | string;
  [key: string]: unknown;
}

export interface StationConfig {
  /** Display name for the station (Japanese preferred) */
  name: string;
  /** Station owl:sameAs URI */
  uri: string;
  /** Index from railway stationOrder */
  index: number;
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
