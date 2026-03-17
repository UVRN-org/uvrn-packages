import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

/**
 * Lifecycle contract: when run with stdin closed (no client), the MCP bin exits
 * with code 0. We assert exit code only, not log content.
 */
describe('MCP bin lifecycle', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.resolve(__dirname, '../../../dist/run.js');

  it('exits with code 0 when stdin is closed (non-interactive)', async () => {
    if (!existsSync(distPath)) {
      throw new Error(`dist/run.js not found at ${distPath}. Run npm run build before tests.`);
    }

    const child = spawn(process.execPath, [distPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, LOG_LEVEL: 'error' },
    });

    // Close stdin immediately so the server sees "no client" and exits cleanly.
    child.stdin.end();

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('MCP bin did not exit within 5s'));
      }, 5000);

      child.on('close', (code) => {
        clearTimeout(timeout);
        resolve(code);
      });
      child.on('error', reject);
    });

    expect(exitCode).toBe(0);
  }, 10000);
});
