import type { ClaimRegistration } from '@uvrn/agent';

export function defaultClaimRegistration(claim: string): ClaimRegistration {
  return {
    id: claim,
    label: claim,
    query: claim,
    driftConfig: {
      name: 'default',
      curve: 'LINEAR',
      rate: 0.15,
      staleAfterHours: 720,
      scoreFloor: 0,
    },
    intervalMs: 60_000,
  };
}
