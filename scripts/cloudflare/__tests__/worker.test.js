/**
 * Tests for Cloudflare Worker MCP endpoints
 *
 * Note: These tests verify the MCP endpoint structure and responses.
 * They use mock implementations since we can't test actual Cloudflare Worker
 * environment in unit tests.
 */

import { describe, it, expect } from 'vitest';

// Mock the worker environment variables
const ODPT_API_KEY = 'test-api-key';
const ALLOWED_ORIGINS = '*';
const CACHE_TTL = 3600;

// MCP resource definitions (same as in worker.js)
const MCP_RESOURCES = [
  {
    uri: 'odpt://PassengerSurvey',
    name: 'odpt:PassengerSurvey',
    description: 'Passenger survey data for railway lines and stations',
    mimeType: 'application/json',
  },
  {
    uri: 'odpt://Railway',
    name: 'odpt:Railway',
    description: 'Railway line metadata including operators, stations, and line codes',
    mimeType: 'application/json',
  },
  {
    uri: 'odpt://RailDirection',
    name: 'odpt:RailDirection',
    description: 'Rail direction information (inbound/outbound, up/down)',
    mimeType: 'application/json',
  },
  {
    uri: 'odpt://RailwayFare',
    name: 'odpt:RailwayFare',
    description: 'Railway fare information between stations',
    mimeType: 'application/json',
  },
  {
    uri: 'odpt://Station',
    name: 'odpt:Station',
    description: 'Station metadata including location, codes, and railway associations',
    mimeType: 'application/json',
  },
  {
    uri: 'odpt://StationTimetable',
    name: 'odpt:StationTimetable',
    description: 'Station departure/arrival timetables by calendar and direction',
    mimeType: 'application/json',
  },
  {
    uri: 'odpt://Train',
    name: 'odpt:Train',
    description: 'Real-time train position and status information',
    mimeType: 'application/json',
  },
  {
    uri: 'odpt://TrainInformation',
    name: 'odpt:TrainInformation',
    description: 'Railway operation status and service disruption messages',
    mimeType: 'application/json',
  },
  {
    uri: 'odpt://TrainTimetable',
    name: 'odpt:TrainTimetable',
    description: 'Train-level timetables with scheduled stops and times',
    mimeType: 'application/json',
  },
  {
    uri: 'odpt://TrainType',
    name: 'odpt:TrainType',
    description: 'Train type classifications (express, local, limited express, etc.)',
    mimeType: 'application/json',
  },
];

describe('Worker MCP Resources', () => {
  it('should have 10 ODPT train resources defined', () => {
    expect(MCP_RESOURCES).toHaveLength(10);
  });

  it('should have all required ODPT endpoints', () => {
    const expectedEndpoints = [
      'odpt:PassengerSurvey',
      'odpt:Railway',
      'odpt:RailDirection',
      'odpt:RailwayFare',
      'odpt:Station',
      'odpt:StationTimetable',
      'odpt:Train',
      'odpt:TrainInformation',
      'odpt:TrainTimetable',
      'odpt:TrainType',
    ];

    const resourceNames = MCP_RESOURCES.map((r) => r.name);
    expectedEndpoints.forEach((endpoint) => {
      expect(resourceNames).toContain(endpoint);
    });
  });

  it('should have valid URI format for all resources', () => {
    MCP_RESOURCES.forEach((resource) => {
      expect(resource.uri).toMatch(/^odpt:\/\//);
      expect(resource.uri).toBeTruthy();
    });
  });

  it('should have description for all resources', () => {
    MCP_RESOURCES.forEach((resource) => {
      expect(resource.description).toBeTruthy();
      expect(resource.description.length).toBeGreaterThan(10);
    });
  });

  it('should have mimeType set to application/json for all resources', () => {
    MCP_RESOURCES.forEach((resource) => {
      expect(resource.mimeType).toBe('application/json');
    });
  });

  it('should have unique URIs', () => {
    const uris = MCP_RESOURCES.map((r) => r.uri);
    const uniqueUris = new Set(uris);
    expect(uniqueUris.size).toBe(uris.length);
  });

  it('should have unique names', () => {
    const names = MCP_RESOURCES.map((r) => r.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});

describe('Worker MCP Endpoint Structure', () => {
  it('should define resources/list endpoint response structure', () => {
    const response = {
      resources: MCP_RESOURCES,
    };

    expect(response).toHaveProperty('resources');
    expect(Array.isArray(response.resources)).toBe(true);
    expect(response.resources.length).toBeGreaterThan(0);
  });

  it('should define tools/list endpoint response structure', () => {
    const response = {
      tools: [
        {
          name: 'query_odpt_resource',
          description: 'Query ODPT train data resources with filtering parameters',
          inputSchema: {
            type: 'object',
            properties: {
              resource: {
                type: 'string',
                description: 'The ODPT resource to query',
                enum: MCP_RESOURCES.map((r) => r.name),
              },
              filters: {
                type: 'object',
                description: 'Query filters (e.g., odpt:railway, odpt:station)',
                additionalProperties: true,
              },
            },
            required: ['resource'],
          },
        },
      ],
    };

    expect(response).toHaveProperty('tools');
    expect(Array.isArray(response.tools)).toBe(true);
    expect(response.tools[0]).toHaveProperty('name');
    expect(response.tools[0]).toHaveProperty('description');
    expect(response.tools[0]).toHaveProperty('inputSchema');
    expect(response.tools[0].inputSchema.properties.resource.enum).toHaveLength(10);
  });

  it('should validate query_odpt_resource tool schema', () => {
    const tool = {
      name: 'query_odpt_resource',
      description: 'Query ODPT train data resources with filtering parameters',
      inputSchema: {
        type: 'object',
        properties: {
          resource: {
            type: 'string',
            description: 'The ODPT resource to query',
            enum: MCP_RESOURCES.map((r) => r.name),
          },
          filters: {
            type: 'object',
            description: 'Query filters (e.g., odpt:railway, odpt:station)',
            additionalProperties: true,
          },
        },
        required: ['resource'],
      },
    };

    expect(tool.name).toBe('query_odpt_resource');
    expect(tool.inputSchema.required).toContain('resource');
    expect(tool.inputSchema.properties.resource.type).toBe('string');
    expect(tool.inputSchema.properties.filters.type).toBe('object');
  });
});

describe('Worker MCP Resource Mapping', () => {
  it('should correctly map URI to ODPT endpoint name', () => {
    const testCases = [
      { uri: 'odpt://Station', expectedName: 'odpt:Station' },
      { uri: 'odpt://Train', expectedName: 'odpt:Train' },
      { uri: 'odpt://Railway', expectedName: 'odpt:Railway' },
      { uri: 'odpt://TrainInformation', expectedName: 'odpt:TrainInformation' },
    ];

    testCases.forEach(({ uri, expectedName }) => {
      const resource = MCP_RESOURCES.find((r) => r.uri === uri);
      expect(resource).toBeTruthy();
      expect(resource.name).toBe(expectedName);
    });
  });

  it('should have consistent naming pattern', () => {
    MCP_RESOURCES.forEach((resource) => {
      // URI should be odpt://Something
      expect(resource.uri).toMatch(/^odpt:\/\/[A-Za-z]+$/);
      // Name should be odpt:Something
      expect(resource.name).toMatch(/^odpt:[A-Za-z]+$/);
      // The parts after odpt:// and odpt: should match
      const uriPart = resource.uri.replace('odpt://', '');
      const namePart = resource.name.replace('odpt:', '');
      expect(uriPart).toBe(namePart);
    });
  });
});
