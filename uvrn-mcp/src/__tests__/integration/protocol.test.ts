import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createTestBundle } from '../fixtures/bundles';

function parseToolResult(result: { content?: Array<{ text?: string }> }) {
  const text = result.content?.[0]?.text;
  if (!text) {
    throw new Error('Tool response missing text content');
  }
  return JSON.parse(text) as Record<string, unknown>;
}

describe('MCP Protocol Compliance', () => {
  let client: Client;

  beforeAll(async () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const distPath = path.resolve(__dirname, '../../../dist/run.js');
    if (!existsSync(distPath)) {
      throw new Error(`dist/run.js not found at ${distPath}. Run npm run build before tests.`);
    }

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [distPath],
      env: { ...process.env, LOG_LEVEL: 'error' },
    });
    client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);
  }, 20000);

  afterAll(async () => {
    if (client) {
      await client.close();
    }
  });

  it('should initialize server', () => {
    expect(client).toBeDefined();
  });

  it('should list tools', async () => {
    const tools = await client.listTools();
    expect(tools.tools).toHaveLength(3);
    expect(tools.tools.map((t) => t.name)).toEqual([
      'delta_run_engine',
      'delta_validate_bundle',
      'delta_verify_receipt',
    ]);
  });

  it('should list resources', async () => {
    const resources = await client.listResources();
    expect(resources.resources).toHaveLength(4);
  });

  it('should list prompts', async () => {
    const prompts = await client.listPrompts();
    expect(prompts.prompts).toHaveLength(3);
  });

  it('should call tool successfully', async () => {
    const result = await client.callTool({
      name: 'delta_validate_bundle',
      arguments: { bundle: createTestBundle() },
    });
    expect(result.isError).toBeFalsy();
    const payload = parseToolResult(result);
    expect(payload.valid).toBe(true);
  });

  it('should handle tool errors correctly', async () => {
    const result = await client.callTool({
      name: 'delta_run_engine',
      arguments: { bundle: createTestBundle({ thresholdPct: 0 }) },
    });
    expect(result.isError).toBeTruthy();
    const payload = parseToolResult(result);
    expect(payload.code).toBe('VALIDATION_ERROR');
  });

  it('should read resources', async () => {
    const resource = await client.readResource({
      uri: 'mcp://delta-engine/schema/bundle',
    });
    const text = resource.contents?.[0]?.text;
    expect(text).toBeDefined();
    const parsed = JSON.parse(text ?? '{}') as Record<string, unknown>;
    expect(parsed.properties).toBeDefined();
  });
});
