import { SignalBus } from './SignalBus';
import type { SignalEventKey, SignalEventMap, SignalHandler, UVRNEventMap } from '../types';

export class SignalBridge<TEventMap extends SignalEventMap = UVRNEventMap> {
  private readonly source: SignalBus<TEventMap>;
  private readonly target: SignalBus<TEventMap>;
  private readonly handlers = new Map<SignalEventKey<TEventMap>, SignalHandler<TEventMap, SignalEventKey<TEventMap>>>();

  constructor(source: SignalBus<TEventMap>, target: SignalBus<TEventMap>) {
    this.source = source;
    this.target = target;
  }

  connect<TEvent extends SignalEventKey<TEventMap>>(event: TEvent): this {
    if (this.handlers.has(event)) {
      return this;
    }

    const handler: SignalHandler<TEventMap, TEvent> = (payload) => {
      this.target.emit(event, payload);
    };

    this.handlers.set(
      event,
      handler as SignalHandler<TEventMap, SignalEventKey<TEventMap>>
    );
    this.source.on(event, handler);
    return this;
  }

  disconnect<TEvent extends SignalEventKey<TEventMap>>(event: TEvent): this {
    const handler = this.handlers.get(event);
    if (!handler) {
      return this;
    }

    this.source.off(event, handler as SignalHandler<TEventMap, TEvent>);
    this.handlers.delete(event);
    return this;
  }

  disconnectAll(): this {
    for (const event of this.handlers.keys()) {
      this.disconnect(event);
    }

    return this;
  }
}
