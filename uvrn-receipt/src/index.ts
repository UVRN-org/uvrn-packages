/**
 * @uvrn/receipt — the canonical UVRN receipt object model.
 * One module defines what a receipt is; every surface (packages, MCP, portal, worker, dashboard)
 * imports it. UI/UX can be rebuilt at will without touching receipt identity.
 */

export * from './types';
export * from './canonical';
export * from './schema';
export * from './topics';
export * from './vocabulary';
export * from './sign';
export * from './envelope';
export * from './render';
