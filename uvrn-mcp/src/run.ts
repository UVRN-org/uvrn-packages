#!/usr/bin/env node

/**
 * Bin entry: run the MCP server. Do not use as library entry — use the package
 * main export (createServer / startServer) for programmatic use.
 */

import { startServer } from './server.js';
import { logger } from './logger.js';

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
  process.exit(1);
});

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
