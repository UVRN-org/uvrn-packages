export const DEFAULT_COOLDOWN_MS = 300_000;

export function resolveCooldown(cooldown?: number): number {
  if (typeof cooldown !== 'number' || !Number.isFinite(cooldown) || cooldown < 0) {
    return DEFAULT_COOLDOWN_MS;
  }

  return cooldown;
}

export function isInCooldown(
  lastAlertAt: number | undefined,
  cooldownMs: number,
  now: number
): boolean {
  if (lastAlertAt === undefined) {
    return false;
  }

  return now - lastAlertAt < cooldownMs;
}
