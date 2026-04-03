import { execFileSync } from 'node:child_process';

const ports = process.argv.slice(2).map((value) => Number.parseInt(value, 10)).filter(Number.isFinite);

for (const port of ports) {
  try {
    const output = execFileSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' }).trim();
    if (!output) {
      continue;
    }

    const pids = [...new Set(output.split(/\s+/).filter(Boolean))];
    for (const pid of pids) {
      execFileSync('kill', ['-TERM', pid], { stdio: 'ignore' });
      process.stdout.write(`freed tcp:${port} from pid ${pid}\n`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('Command failed')) {
      throw error;
    }
  }
}
