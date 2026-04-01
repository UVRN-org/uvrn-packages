// ─────────────────────────────────────────────────────────────
// @uvrn/agent — scheduler
// ─────────────────────────────────────────────────────────────

type TickCallback = (claimId: string) => Promise<void>;

interface ScheduledClaim {
  claimId:    string;
  intervalMs: number;
  timer:      ReturnType<typeof setTimeout> | null;
  nextRunAt:  number;
  running:    boolean;
}

export class Scheduler {
  private claims   = new Map<string, ScheduledClaim>();
  private jitterMs: number;
  private onTick:   TickCallback;

  constructor(onTick: TickCallback, jitterMs = 2000) {
    this.onTick   = onTick;
    this.jitterMs = jitterMs;
  }

  register(claimId: string, intervalMs: number): void {
    if (this.claims.has(claimId)) {
      this.unregister(claimId);
    }

    const jitter = Math.random() * this.jitterMs;
    const firstRunMs = Math.max(100, jitter);

    const entry: ScheduledClaim = {
      claimId,
      intervalMs,
      timer:     null,
      nextRunAt: Date.now() + firstRunMs,
      running:   false,
    };

    this.claims.set(claimId, entry);
    this.scheduleNext(claimId, firstRunMs);
  }

  unregister(claimId: string): void {
    const entry = this.claims.get(claimId);
    if (entry?.timer) clearTimeout(entry.timer);
    this.claims.delete(claimId);
  }

  stopAll(): void {
    for (const [id] of this.claims) {
      this.unregister(id);
    }
  }

  nextRunIn(claimId: string): number {
    const entry = this.claims.get(claimId);
    if (!entry) return -1;
    return Math.max(0, entry.nextRunAt - Date.now());
  }

  private scheduleNext(claimId: string, delayMs: number): void {
    const entry = this.claims.get(claimId);
    if (!entry) return;

    entry.timer = setTimeout(async () => {
      if (entry.running) {
        this.scheduleNext(claimId, 5000);
        return;
      }

      entry.running   = true;
      entry.nextRunAt = Date.now() + entry.intervalMs;

      try {
        await this.onTick(claimId);
      } finally {
        entry.running = false;
        const jitter  = (Math.random() - 0.5) * this.jitterMs;
        const nextMs  = Math.max(1000, entry.intervalMs + jitter);
        this.scheduleNext(claimId, nextMs);
      }
    }, delayMs);
  }
}
