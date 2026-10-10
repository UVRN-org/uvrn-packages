import { EventEmitter } from 'node:events';

import type { SignalEventKey, SignalEventMap, SignalHandler, UVRNEventMap } from '../types';

export class SignalBus<TEventMap extends SignalEventMap = UVRNEventMap> {
  private readonly emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
  }

  on<TEvent extends SignalEventKey<TEventMap>>(
    event: TEvent,
    handler: SignalHandler<TEventMap, TEvent>
  ): this {
    this.emitter.on(event, handler as (payload: unknown) => void);
    return this;
  }

  off<TEvent extends SignalEventKey<TEventMap>>(
    event: TEvent,
    handler: SignalHandler<TEventMap, TEvent>
  ): this {
    this.emitter.off(event, handler as (payload: unknown) => void);
    return this;
  }

  once<TEvent extends SignalEventKey<TEventMap>>(
    event: TEvent,
    handler: SignalHandler<TEventMap, TEvent>
  ): this {
    this.emitter.once(event, handler as (payload: unknown) => void);
    return this;
  }

  emit<TEvent extends SignalEventKey<TEventMap>>(event: TEvent, payload: TEventMap[TEvent]): boolean {
    return this.emitter.emit(event, payload);
  }

  removeAllListeners<TEvent extends SignalEventKey<TEventMap>>(event?: TEvent): this {
    if (event) {
      this.emitter.removeAllListeners(event);
      return this;
    }

    this.emitter.removeAllListeners();
    return this;
  }
}
