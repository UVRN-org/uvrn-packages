export * from './types';
export { IdentityRegistry, MockIdentityStore } from './registry/IdentityRegistry';
export {
  SIG_VERSION,
  buildEvidencePayload,
  verifyAttestedEvidence,
} from './registry/attestation';
