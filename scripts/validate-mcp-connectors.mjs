import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const expectedLaunch = { command: 'npx', args: ['-y', '@uvrn/mcp'] };

const desktop = JSON.parse(read('uvrn-mcp/connectors/claude-desktop.json'));
assert.deepEqual(
  {
    command: desktop.mcpServers?.uvrn?.command,
    args: desktop.mcpServers?.uvrn?.args,
  },
  expectedLaunch,
  'Claude Desktop connector must use the zero-config npx launch'
);

const claudeCode = JSON.parse(read('.mcp.json'));
assert.deepEqual(
  {
    command: claudeCode.mcpServers?.uvrn?.command,
    args: claudeCode.mcpServers?.uvrn?.args,
  },
  { command: 'node', args: ['uvrn-mcp/dist/index.js'] },
  'Claude Code connector must retain the pure relative local-build launch'
);

const hermes = read('uvrn-mcp/connectors/hermes.config.yaml');
assert.match(hermes, /^mcp_servers:\n  uvrn:\n    command: "npx"\n    args: \["-y", "@uvrn\/mcp"\]/m);
assert.match(hermes, /mcp_uvrn_delta_run_engine/);

const odysseus = read('uvrn-mcp/connectors/odysseus.md');
assert.match(odysseus, /Command:\*\* `npx`/);
assert.match(odysseus, /Args:\*\* `-y @uvrn\/mcp`/);
assert.match(odysseus, /9 tools/);

const manifest = JSON.parse(read('uvrn-mcp/plugin-manifest.json'));
assert.equal(manifest.capabilities.tools.length, 9);
assert.equal(new Set(manifest.capabilities.tools).size, 9);

console.log(
  'PASS: Claude Desktop, Claude Code, Hermes, and Odysseus profiles match the nine-tool stdio contract'
);
