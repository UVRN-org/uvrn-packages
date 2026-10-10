// Role label + organize helpers (BP-v2.1-Spread).
// Locked model (Shawn Q2): label + organize (+ assumed-with-why).
// Missing role → no_role / unknown; all data stays organized; never invent silently.

import type {
  EvidenceClass,
  OrganizedSpreadSources,
  RoleAssignment,
  SpreadSourceInput,
} from './types';

const EMPTY_BY_CLASS = (): Record<EvidenceClass, SpreadSourceInput[]> => ({
  attention: [],
  interest: [],
  supply_entry: [],
  purchase: [],
  repeat_purchase: [],
  commercial_outcome: [],
  market_expansion: [],
});

/**
 * Normalize a host/agent role assignment into the locked vocabulary.
 * Does not invent a class when missing. Assumed without `why` is incomplete assumed
 * (kept in `incompleteAssumed`, not silently invented as declared).
 */
export function normalizeRoleAssignment(
  role: RoleAssignment | undefined
): RoleAssignment {
  if (role === undefined || role === null) {
    return { provenance: 'no_role' };
  }

  const provenance = role.provenance;
  if (provenance === 'no_role' || provenance === 'unknown') {
    return {
      provenance,
      evidenceClass: undefined,
      why: undefined,
      claimId: role.claimId,
    };
  }

  if (provenance === 'assumed') {
    return {
      provenance: 'assumed',
      evidenceClass: role.evidenceClass,
      why: role.why,
      claimId: role.claimId,
    };
  }

  return {
    provenance: 'declared',
    evidenceClass: role.evidenceClass,
    why: undefined,
    claimId: role.claimId,
  };
}

/** True when assumed provenance lacks required why provenance. */
export function isAssumedMissingWhy(role: RoleAssignment): boolean {
  return (
    role.provenance === 'assumed' &&
    (role.why === undefined || role.why.trim().length === 0)
  );
}

/** True when the assignment can participate in Spread PASS partition math. */
export function isPartitionableRole(role: RoleAssignment): boolean {
  if (role.provenance !== 'declared' && role.provenance !== 'assumed') {
    return false;
  }
  if (role.evidenceClass === undefined) {
    return false;
  }
  if (role.provenance === 'assumed' && isAssumedMissingWhy(role)) {
    return false;
  }
  return true;
}

/**
 * Label each source with a normalized role. Missing input role → `no_role`.
 * Does not drop sources.
 */
export function labelRoles(sources: SpreadSourceInput[]): SpreadSourceInput[] {
  return sources.map((source) => ({
    ...source,
    role: normalizeRoleAssignment(source.role),
  }));
}

/**
 * Organize all sources by role class / no_role / incompleteAssumed / unknown.
 * Every input remains addressable — organize-all even under unknown / no_role.
 */
export function organizeByRole(sources: SpreadSourceInput[]): OrganizedSpreadSources {
  const labeled = labelRoles(sources);
  const byClass = EMPTY_BY_CLASS();
  const noRole: SpreadSourceInput[] = [];
  const incompleteAssumed: SpreadSourceInput[] = [];
  const unknown: SpreadSourceInput[] = [];
  const assumed: SpreadSourceInput[] = [];
  const declared: SpreadSourceInput[] = [];

  for (const source of labeled) {
    const role = source.role!;
    if (role.provenance === 'declared') {
      declared.push(source);
      if (role.evidenceClass !== undefined) {
        byClass[role.evidenceClass].push(source);
      } else {
        noRole.push(source);
      }
      continue;
    }
    if (role.provenance === 'assumed') {
      assumed.push(source);
      if (isPartitionableRole(role) && role.evidenceClass !== undefined) {
        byClass[role.evidenceClass].push(source);
      } else {
        incompleteAssumed.push(source);
      }
      continue;
    }
    if (role.provenance === 'unknown') {
      unknown.push(source);
      continue;
    }
    noRole.push(source);
  }

  return { byClass, noRole, incompleteAssumed, unknown, assumed, declared };
}
