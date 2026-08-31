export * from './types';
export { IdentityRegistry, MockIdentityStore } from './registry/IdentityRegistry';
export {
  SIG_VERSION,
  buildEvidencePayload,
  verifyAttestedEvidence,
} from './registry/attestation';
export {
  FIXTURE_CONTINUITY_SCHEMA,
  exportFixtureSnapshot,
  hydrateFixtureSnapshot,
  type FixtureContinuitySnapshot,
} from './registry/fixtureContinuity';
