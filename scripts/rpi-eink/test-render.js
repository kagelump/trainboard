#!/usr/bin/env node
/**
 * test-render.js
 * Test the render-to-image.js script with mock data
 */

const fs = require('fs');
const path = require('path');

// Mock canvas for testing
const mockCanvas = {
  createCanvas: (width, height) => ({
    width,
    height,
    getContext: () => ({
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      fillRect: () => {},
      fillText: () => {},
      strokeText: () => {},
      measureText: (text) => ({ width: text.length * 10 }),
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      closePath: () => {},
    }),
    toBuffer: () => {
      // Generate a simple PNG header for testing
      const width = 960;
      const height = 640;
      const header = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      ]);
      // Simple mock PNG (not a valid image, but demonstrates structure)
      return Buffer.concat([header, Buffer.alloc(100)]);
    },
  }),
  registerFont: () => {},
};

// Override require for canvas
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  if (id === 'canvas') {
    console.log('[TEST] Using mock canvas');
    return mockCanvas;
  }
  return originalRequire.apply(this, arguments);
};

// Mock HTTP/HTTPS for testing
const mockRailwayData = {
  '@type': 'odpt:Railway',
  'owl:sameAs': 'odpt.Railway:Tokyu.Toyoko',
  'dc:title': { ja: '東急東横線', en: 'Tokyu Toyoko Line' },
  'odpt:ascendingRailDirection': 'odpt.RailDirection:Tokyu.Toyoko.Inbound',
  'odpt:descendingRailDirection': 'odpt.RailDirection:Tokyu.Toyoko.Outbound',
  'odpt:stationOrder': [
    {
      'odpt:index': 11,
      'odpt:station': 'odpt.Station:Tokyu.Toyoko.MusashiKosugi',
      'odpt:stationTitle': { ja: '武蔵小杉', en: 'Musashi-Kosugi' },
    },
  ],
};

const mockTimetableData = [
  {
    '@type': 'odpt:StationTimetable',
    'odpt:station': 'odpt.Station:Tokyu.Toyoko.MusashiKosugi',
    'odpt:stationTimetableObject': [
      {
        'odpt:departureTime': '12:35',
        'odpt:destinationStation': ['odpt.Station:Tokyu.Toyoko.Shibuya'],
        'odpt:trainType': 'odpt.TrainType:Tokyu.Toyoko.Express',
        'odpt:railDirection': 'odpt.RailDirection:Tokyu.Toyoko.Inbound',
      },
      {
        'odpt:departureTime': '12:42',
        'odpt:destinationStation': ['odpt.Station:Tokyu.Toyoko.Shibuya'],
        'odpt:trainType': 'odpt.TrainType:Tokyu.Toyoko.Local',
        'odpt:railDirection': 'odpt.RailDirection:Tokyu.Toyoko.Inbound',
      },
      {
        'odpt:departureTime': '12:38',
        'odpt:destinationStation': ['odpt.Station:Tokyu.Toyoko.Yokohama'],
        'odpt:trainType': 'odpt.TrainType:Tokyu.Toyoko.Local',
        'odpt:railDirection': 'odpt.RailDirection:Tokyu.Toyoko.Outbound',
      },
    ],
  },
];

const https = require('https');
const http = require('http');

const originalHttpsGet = https.get;
const originalHttpGet = http.get;

https.get = function(url, callback) {
  console.log('[TEST] Mocking HTTPS GET:', typeof url === 'string' ? url : url.href);
  
  const mockRes = {
    statusCode: 200,
    statusMessage: 'OK',
    on: function(event, handler) {
      if (event === 'data') {
        setImmediate(() => {
          if (url.includes('odpt:Railway')) {
            handler(JSON.stringify([mockRailwayData]));
          } else if (url.includes('odpt:StationTimetable')) {
            handler(JSON.stringify(mockTimetableData));
          } else {
            handler(JSON.stringify([]));
          }
        });
      } else if (event === 'end') {
        setImmediate(handler);
      }
      return this;
    },
  };
  
  setImmediate(() => callback(mockRes));
  
  return {
    on: () => {},
  };
};

http.get = https.get;

// Now run the actual script
const { renderToImage } = require('./render-to-image.js');

async function test() {
  const outputPath = '/tmp/test-trainboard.png';
  
  console.log('[TEST] Starting render test...');
  
  try {
    await renderToImage(outputPath, 960, 640, {
      API_BASE_URL: 'https://api-challenge.odpt.org/api/v4/',
      DEFAULT_RAILWAY: 'odpt.Railway:Tokyu.Toyoko',
      DEFAULT_STATION_NAME: '武蔵小杉',
    });
    
    console.log('[TEST] Render completed successfully!');
    
    // Check if file was created
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log(`[TEST] Output file exists: ${outputPath} (${stats.size} bytes)`);
      console.log('[TEST] ✅ All tests passed!');
      process.exit(0);
    } else {
      console.error('[TEST] ❌ Output file was not created');
      process.exit(1);
    }
  } catch (error) {
    console.error('[TEST] ❌ Test failed:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

test();
