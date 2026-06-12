/**
 * @uvrn/store-sqlite — every UVRN store interface implemented against one local SQLite file.
 * Durable AND zero-signup: the file-based zero-external path (plan A3). This is also the local
 * store of the desktop dashboard: same file, same interfaces, plus pushToNetwork() sync.
 */

export * from './db';
export * from './stores';
export * from './edge-stores';
export * from './receipt-store';
