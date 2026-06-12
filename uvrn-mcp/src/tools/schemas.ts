/**
 * MCP Tool Schemas
 * JSON Schema definitions for tool inputs
 */

export const runEngineSchema = {
  type: 'object',
  properties: {
    bundle: {
      type: 'object',
      description: 'DeltaBundle to process',
      properties: {
        bundleId: { type: 'string', description: 'Unique bundle identifier' },
        claim: { type: 'string', description: 'Claim being verified' },
        dataSpecs: {
          type: 'array',
          description: 'Array of data specifications (minimum 2)',
          minItems: 2,
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              sourceKind: { 
                type: 'string',
                enum: ['report', 'metric', 'chart', 'meta']
              },
              originDocIds: { type: 'array', items: { type: 'string' } },
              metrics: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    key: { type: 'string' },
                    value: { type: 'number' },
                    unit: { type: 'string' },
                    ts: { type: 'string' },
                  },
                  required: ['key', 'value'],
                },
              },
            },
            required: ['id', 'label', 'sourceKind', 'originDocIds', 'metrics'],
          },
        },
        thresholdPct: { 
          type: 'number',
          description: 'Threshold percentage (must be > 0 and <= 1.0)',
          minimum: 0.001,
          exclusiveMinimum: true,
          maximum: 1,
        },
        maxRounds: { 
          type: 'number',
          description: 'Maximum rounds (default: 5)',
        },
      },
      required: ['bundleId', 'claim', 'dataSpecs', 'thresholdPct'],
    },
    options: {
      type: 'object',
      description: 'Optional execution options',
      properties: {
        timestamp: { 
          type: 'string',
          description: 'ISO timestamp for receipt envelope',
        },
      },
    },
  },
  required: ['bundle'],
};

export const validateBundleSchema = {
  type: 'object',
  properties: {
    bundle: {
      type: 'object',
      description: 'DeltaBundle to validate (same structure as runEngine)',
    },
  },
  required: ['bundle'],
};

export const verifyReceiptSchema = {
  type: 'object',
  properties: {
    receipt: {
      type: 'object',
      description: 'DeltaReceipt to verify',
      properties: {
        bundleId: { type: 'string' },
        deltaFinal: { type: 'number' },
        sources: { type: 'array', items: { type: 'string' } },
        rounds: { type: 'array' },
        suggestedFixes: { type: 'array' },
        outcome: { 
          type: 'string',
          enum: ['consensus', 'indeterminate']
        },
        ts: { type: 'string' },
        hash: { type: 'string', description: 'SHA-256 hash of canonical payload' },
      },
      required: ['bundleId', 'deltaFinal', 'sources', 'rounds', 'outcome', 'hash'],
    },
  },
  required: ['receipt'],
};

export const scoreDriftSchema = {
  type: 'object',
  properties: {
    receipt: {
      type: 'object',
      description:
        'Already enriched DriftInputReceipt with receipt_id, issuer, timestamp, v_score, and components. Raw DeltaReceipt input is rejected because it lacks v_score and components.',
      properties: {
        receipt_id: { type: 'string' },
        issuer: { type: 'string' },
        timestamp: { type: 'string' },
        v_score: { type: 'number' },
        components: {
          type: 'object',
          properties: {
            completeness: { type: 'number' },
            parity: { type: 'number' },
            freshness: { type: 'number' },
          },
          required: ['completeness', 'parity', 'freshness'],
        },
        claim_id: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['receipt_id', 'issuer', 'timestamp', 'v_score', 'components'],
    },
    asOf: {
      type: 'string',
      description: 'Optional ISO timestamp to score drift as of; defaults to now.',
    },
    profile: {
      type: 'string',
      description: 'Optional drift profile name resolved by @uvrn/drift profileFor(); defaults to the drift package default.',
    },
  },
  required: ['receipt'],
};

export const compareSchema = {
  type: 'object',
  properties: {
    receipts: {
      type: 'array',
      description:
        'Exactly two already scored receipts. Each receipt must carry claimId or claim_id plus vScore or v_score. Raw DeltaReceipt input is rejected because it lacks those fields.',
      minItems: 2,
      maxItems: 2,
      items: {
        type: 'object',
        properties: {
          claimId: { type: 'string' },
          claim_id: { type: 'string' },
          vScore: { type: 'number' },
          v_score: { type: 'number' },
          status: { type: 'string' },
          scoredAt: { type: 'string' },
          scored_at: { type: 'string' },
        },
      },
    },
    options: {
      type: 'object',
      properties: {
        normalize: {
          type: 'boolean',
          description: 'When true, V-Scores between 0 and 1 are normalized to 0-100.',
        },
      },
    },
  },
  required: ['receipts'],
};

export const verifyIdentitySchema = {
  type: 'object',
  properties: {
    address: {
      type: 'string',
      description: 'Signer address to look up in the in-memory MockIdentityStore.',
    },
  },
  required: ['address'],
};

export const canonQualifySchema = {
  type: 'object',
  properties: {
    claimId: {
      type: 'string',
      description: 'Claim id to assess for canon qualification.',
    },
    snapshot: {
      type: 'object',
      description: 'DriftSnapshot to assess. This is read-only and does not canonize or write.',
    },
  },
  required: ['claimId', 'snapshot'],
};

export const canonGetSchema = {
  type: 'object',
  properties: {
    canonId: {
      type: 'string',
      description: 'Canon receipt id to read via CanonStore.read(canonId).',
    },
  },
  required: ['canonId'],
};

export const scoreClaimSchema = {
  type: 'object',
  properties: {
    claim: {
      type: 'string',
      description: 'Claim text to adapt into a ClaimRegistration before fetching connector sources.',
    },
    claimId: {
      type: 'string',
      description: 'Optional stable claim id; defaults to a slug derived from claim text.',
    },
    label: {
      type: 'string',
      description: 'Optional display label for the claim registration.',
    },
    topic: {
      type: 'string',
      description:
        'Optional topic for the resulting NetworkReceipt, serialized as domain[/subject[/instrument]] (e.g. "markets/crypto/BTC"). Normalized via @uvrn/receipt normalizeTopic(): segments are lowercased and unknown domains are accepted under custom/ — never rejected.',
    },
    sources: {
      type: 'array',
      description:
        'Optional host-provided evidence. If you (the calling agent) can search the web, gather 2+ sources and pass them here; this skips connector fetch. Precedence: any non-empty array requests host-evidence mode, so exactly one source is rejected (it does not fall back to a connector/mock). If omitted or empty, the server uses a configured connector, or mock data as a last resort.',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          title: { type: 'string' },
          snippet: { type: 'string' },
          publishedAt: { type: 'string', description: 'ISO timestamp' },
          credibility: { type: 'number', minimum: 0, maximum: 1, description: '0–1 source reliability' },
          evidenceScore: { type: 'number', minimum: 0, maximum: 100, description: '0–100 host-derived trend-support score' },
        },
        required: ['url', 'title', 'snippet'],
      },
    },
  },
  required: ['claim'],
};
