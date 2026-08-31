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
        claim: { type: 'string', description: 'Claim the bundle is measured against' },
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
          exclusiveMinimum: 0,
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

/**
 * Easy-verify DataPoint front desk (`@uvrn/validate`).
 * Distinct from `delta_validate_bundle` — do not overload bundles with DataPoints.
 * Never emits `verified`. Stage1 is structurally-ok | malformed only.
 */
export const validateDatapointSchema = {
  type: 'object',
  properties: {
    dataPoint: {
      type: 'object',
      description:
        'Minimal DataPoint: id, kind, value (required presence), optional sourceRef. Not a DeltaBundle.',
      properties: {
        id: { type: 'string', description: 'Stable caller id for the point' },
        kind: { type: 'string', description: 'Caller-declared kind (open string in v0)' },
        value: {
          description: 'Payload to shape-check (presence required; deep schema by kind = later)',
        },
        sourceRef: {
          type: 'string',
          description: 'Optional reference; v0 does not invent a new connector contract',
        },
      },
      required: ['id', 'kind', 'value'],
    },
    runStage2: {
      type: 'boolean',
      description:
        'Explicit Stage2 gate. When false/omitted, measure is never called. When true with fewer than 2 host sources → honest insufficient-data (success). When true with ≥2 sources, routes into existing @uvrn/measure vocabulary. Never auto-runs connectors/mock.',
    },
    claim: {
      type: 'string',
      description: 'Optional claim text forwarded to measure when Stage2 runs.',
    },
    sources: {
      type: 'array',
      description:
        'Optional host evidence for Stage2 only. Counted when runStage2 is true. Fewer than 2 → insufficient-data. Shape is score_claim-compatible enough for measure (id/url, value or assertion).',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          url: { type: 'string' },
          value: { type: 'number' },
          assertion: { type: 'string' },
          label: { type: 'string' },
          title: { type: 'string' },
          kind: {
            type: 'string',
            enum: ['numeric', 'categorical', 'boolean', 'range'],
          },
          ts: { type: 'string' },
        },
      },
    },
  },
  required: ['dataPoint'],
};

export const verifyReceiptSchema = {
  type: 'object',
  properties: {
    receipt: {
      type: 'object',
      description: 'DeltaReceipt to integrity-check by recomputing its hash',
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

/**
 * Post-pipeline (BP-v2.1-LATER-D4): thin MCP wrapper around lattice `readSupport`.
 * Call after `delta_score_claim` when the host wants claim-ladder sufficiency — not a
 * second scoring engine and not accuracy/verification.
 */
export const readSupportSchema = {
  type: 'object',
  properties: {
    claim: {
      type: 'string',
      description:
        'Claim text (or claim species) to grade for support sufficiency via lattice `readSupport` / claim ladder.',
    },
    evidence: {
      type: 'array',
      description:
        'Required evidence items for sufficiency grading. Prefer tagged items with `evidenceClass` + `source`, or taggable `{ source, originId? }` entries. Empty array is valid input and yields an honest Unverified / empty-coverage readout — omitting the field is a validation error.',
      items: {
        type: 'object',
        properties: {
          evidenceClass: {
            type: 'string',
            description:
              'Optional classified evidence class (purchase, attention, …). When present the item is taken as already tagged.',
          },
          source: {
            type: 'string',
            description: 'Source label used for tagging / origin transparency.',
          },
          originId: {
            type: 'string',
            description: 'Optional host-declared origin identity for distinct-origin corroboration.',
          },
          explanation: {
            type: 'string',
            description: 'Optional explanation string (recommended for classified EvidenceItem).',
          },
          key: { type: 'string' },
          value: { type: 'number' },
          ts: { type: 'string', description: 'Optional ISO timestamp' },
        },
        required: ['source'],
      },
    },
    ts: {
      type: 'string',
      description: 'Optional ISO timestamp forwarded to `readSupport` options.',
    },
  },
  required: ['claim', 'evidence'],
};

/**
 * Post-pipeline (BP-v2.1-LATER-D4): thin MCP wrapper around algox `reportRankStability`.
 * Ordering stability only — not verification, accuracy, market outcome, or publish posture.
 */
export const reportRankStabilitySchema = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      description:
        'Required candidate set to rank. Each entry needs a non-empty `label`. Optional `id`, `url`, `source`, `prominence`, `observedAt`, and `signals` (e.g. mentions) are forwarded to algox.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string', description: 'Human-readable signal name (required).' },
          url: { type: 'string' },
          source: { type: 'string' },
          prominence: { type: 'number' },
          observedAt: { type: 'string' },
          signals: {
            type: 'object',
            additionalProperties: { type: 'number' },
            description: 'Extra named numeric signals (e.g. { "mentions": 1200 }).',
          },
        },
        required: ['label'],
      },
    },
    baseline: {
      type: 'object',
      description:
        'Optional baseline `rankSignals` config. Default weights are `{ prominence: 1 }`. Shared non-weight knobs apply to variants.',
      properties: {
        weights: {
          type: 'object',
          additionalProperties: { type: 'number' },
        },
        now: { type: 'string', description: 'ISO clock for freshness filtering.' },
        topK: { type: 'number' },
        capPerSource: { type: 'number' },
        maxAgeDays: { type: 'number' },
      },
    },
    variants: {
      type: 'array',
      description:
        'Optional declared weight variants. When omitted, algox uses DEFAULT_RANK_STABILITY_VARIANTS (implementer PREP proposal N=3 — not product law).',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          weights: {
            type: 'object',
            additionalProperties: { type: 'number' },
          },
        },
        required: ['name', 'weights'],
      },
    },
  },
  required: ['candidates'],
};

/**
 * Pattern observatory (uvrn-pattern-mining): thin MCP wrapper around @uvrn/pattern scanPatterns.
 * Detected ≠ verified. Not receipt-class. Requires joinScope + window; no silent global scan.
 */
export const patternScanSchema = {
  type: 'object',
  properties: {
    joinScope: {
      type: 'string',
      description:
        'Required disclosure of what is aggregated (privacy / join wall). Unbound scans are refused.',
    },
    window: {
      type: 'object',
      description: 'Required ISO time window for the scoped history batch.',
      properties: {
        from: { type: 'string', description: 'ISO start (inclusive)' },
        to: { type: 'string', description: 'ISO end (inclusive)' },
      },
      required: ['from', 'to'],
    },
    subjectRefs: {
      type: 'array',
      items: { type: 'string' },
      description: 'Optional subject filter (claimIds / originIds).',
    },
    history: {
      type: 'array',
      description:
        'Host-mapped history events from existing store APIs (receipt list / track-record listRecords / etc.). Pass [] for an honest insufficient result. Omit only when RuntimeConfig.patternHistoryReader is injected.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          subjectRef: { type: 'string' },
          observedAt: { type: 'string' },
          originId: { type: 'string' },
          claimId: { type: 'string' },
          kind: { type: 'string' },
          value: { type: 'number' },
        },
        required: ['id', 'subjectRef', 'observedAt'],
      },
    },
    minCount: {
      type: 'number',
      description: 'Optional frequency-spike threshold (default 3).',
    },
  },
  required: ['joinScope', 'window'],
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
    expectedValue: {
      type: 'number',
      description:
        'Optional host-held expectation for the absolute consensus cluster. Returns an observation-only divergence note on the tool result envelope. Does not change outcome, v_score, deltaFinal, or any hashed receipt field. UVRN does not adjudicate which side is right.',
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
          value: {
            type: 'number',
            description:
              'The measurement this source reports, at its own magnitude — a price, a ppm reading, 299792458. Uncapped and never rescaled, but validated finite (NaN/Infinity rejected). When present it is the measurement and takes precedence over evidenceScore.',
          },
          unit: {
            type: 'string',
            description:
              'Free-text unit for `value` (e.g. "m/s", "ppm", "USD"). Recorded and echoed back on the result envelope only — it does not influence any computation yet.',
          },
          evidenceScore: { type: 'number', minimum: 0, maximum: 100, description: '0–100 host-derived quality/trend-support score. Keeps its 0–100 bound; pass a real-world magnitude as `value` instead of rescaling it into this range.' },
          stanceValue: { type: 'number', minimum: -1, maximum: 1, description: 'Explicit numeric claim position; -1 opposes and 1 supports' },
          stanceLabel: {
            type: 'string',
            enum: ['supports', 'opposes', 'mixed', 'neutral', 'insufficient'],
            description: 'Explicit producer-supplied stance label',
          },
          stanceConfidence: { type: 'number', minimum: 0, maximum: 1, description: 'Producer confidence in the supplied stance' },
          stanceEvidence: { type: 'string', description: 'Grounding text for the supplied stance' },
        },
        required: ['url', 'title', 'snippet'],
      },
    },
  },
  required: ['claim'],
};
