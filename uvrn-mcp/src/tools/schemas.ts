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
