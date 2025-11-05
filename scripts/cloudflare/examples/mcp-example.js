#!/usr/bin/env node
/**
 * Example MCP Client for ODPT Train Data
 *
 * This script demonstrates how to use the MCP endpoints to query ODPT train data.
 *
 * Usage:
 *   node mcp-example.js https://your-worker.workers.dev
 */

const WORKER_URL = process.argv[2] || 'https://your-worker.workers.dev';

async function main() {
  console.log('ODPT MCP Client Example\n');
  console.log('Worker URL:', WORKER_URL, '\n');

  try {
    // 1. List available resources
    console.log('1. Listing available resources...');
    const resourcesResponse = await fetch(`${WORKER_URL}/mcp/resources/list`);
    const resourcesData = await resourcesResponse.json();

    console.log(`   Found ${resourcesData.resources.length} resources:`);
    resourcesData.resources.forEach((resource, index) => {
      console.log(`   ${index + 1}. ${resource.name}`);
      console.log(`      URI: ${resource.uri}`);
      console.log(`      Description: ${resource.description}`);
    });
    console.log();

    // 2. List available tools
    console.log('2. Listing available tools...');
    const toolsResponse = await fetch(`${WORKER_URL}/mcp/tools/list`);
    const toolsData = await toolsResponse.json();

    console.log(`   Found ${toolsData.tools.length} tool(s):`);
    toolsData.tools.forEach((tool, index) => {
      console.log(`   ${index + 1}. ${tool.name}`);
      console.log(`      Description: ${tool.description}`);
      console.log(`      Required parameters: ${tool.inputSchema.required.join(', ')}`);
    });
    console.log();

    // 3. Example: Get station data (demonstrates resource/get)
    console.log('3. Example query: Get stations on Tokyu Toyoko line...');
    const stationsUrl =
      `${WORKER_URL}/mcp/resources/get?` +
      `uri=odpt://Station&` +
      `odpt:railway=odpt.Railway:Tokyu.Toyoko`;

    const stationsResponse = await fetch(stationsUrl);
    const stationsData = await stationsResponse.json();

    if (Array.isArray(stationsData)) {
      console.log(`   Found ${stationsData.length} stations`);
      stationsData.slice(0, 5).forEach((station) => {
        const title =
          station['dc:title'] ||
          station['odpt:stationTitle']?.ja ||
          station['owl:sameAs'] ||
          'Unknown';
        const code = station['odpt:stationCode'] || 'N/A';
        console.log(`   - ${title} (${code})`);
      });
      if (stationsData.length > 5) {
        console.log(`   ... and ${stationsData.length - 5} more`);
      }
    } else {
      console.log('   Response:', stationsData);
    }
    console.log();

    // 4. Error handling example
    console.log('4. Example error handling: Invalid resource URI...');
    const errorUrl = `${WORKER_URL}/mcp/resources/get?uri=odpt://InvalidResource`;
    const errorResponse = await fetch(errorUrl);
    const errorData = await errorResponse.json();

    console.log(`   Status: ${errorResponse.status}`);
    console.log(`   Error: ${errorData.error}`);
    console.log(`   Message: ${errorData.message}`);
    console.log();

    console.log('✓ Example completed successfully!\n');
    console.log('Available MCP endpoints:');
    console.log('  - GET /mcp/resources/list');
    console.log('  - GET /mcp/resources/get?uri=<resource-uri>&<filters>');
    console.log('  - GET /mcp/tools/list');
    console.log();
    console.log('See MCP_API.md for complete documentation.');
  } catch (error) {
    console.error('Error:', error.message);
    console.error('\nUsage: node mcp-example.js <worker-url>');
    console.error('Example: node mcp-example.js https://your-worker.workers.dev');
    process.exit(1);
  }
}

main();
