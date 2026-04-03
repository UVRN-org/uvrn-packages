import type { FarmConnector } from '../types';

import { MultiFarm } from '../multi/MultiFarm';

export class ConnectorRegistry {
  private readonly connectors = new Map<string, FarmConnector & { name: string }>();

  register(connector: FarmConnector & { name: string }): void {
    this.connectors.set(connector.name, connector);
  }

  get(name: string): FarmConnector | undefined {
    return this.connectors.get(name);
  }

  list(): string[] {
    return Array.from(this.connectors.keys());
  }

  createMultiFarm(names?: string[]): MultiFarm {
    const selected = names == null
      ? Array.from(this.connectors.values())
      : names
          .map((name) => this.connectors.get(name))
          .filter((connector): connector is FarmConnector & { name: string } => connector != null);

    return new MultiFarm(selected);
  }
}

export const registry = new ConnectorRegistry();
