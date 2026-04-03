import Fastify from 'fastify';
import cors from '@fastify/cors';
import { DEMO_PORTS, registerMockIngestRoutes } from '@uvrn-demo/scenarios';

async function main(): Promise<void> {
  const server = Fastify({ logger: { level: 'info' } });
  await server.register(cors, { origin: true });
  await registerMockIngestRoutes(server);

  const port = Number.parseInt(process.env.PORT ?? String(DEMO_PORTS.mockIngest), 10);
  const host = process.env.HOST ?? '127.0.0.1';

  await server.listen({ host, port });
  server.log.info(`Mock ingest running at http://${host}:${port}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
