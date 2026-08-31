/**
 * Delta Engine MCP Server
 * Main server implementation using MCP SDK
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { logger } from './logger';
import { buildHandlers } from './tools/handlers';
import {
  canonGetSchema,
  canonQualifySchema,
  compareSchema,
  readSupportSchema,
  reportRankStabilitySchema,
  patternScanSchema,
  runEngineSchema,
  scoreClaimSchema,
  scoreDriftSchema,
  validateBundleSchema,
  validateDatapointSchema,
  verifyIdentitySchema,
  verifyReceiptSchema,
} from './tools/schemas';
import { handleResource } from './resources/handlers';
import { getPrompt, listPrompts } from './prompts/templates';
import { resolveRuntimeConfig } from './config';
import { 
  MCPError,
  CanonGetInput,
  CanonQualifyInput,
  CompareReceiptsInput,
  RuntimeConfig,
  RunEngineInput,
  ScoreClaimInput,
  ScoreDriftInput,
  ReadSupportInput,
  ReportRankStabilityInput,
  PatternScanInput,
  ValidateBundleInput,
  ValidateDatapointInput,
  VerifyIdentityInput,
  VerifyReceiptInput,
} from './types';

/**
 * Create and configure the MCP server
 */
export function createServer(runtimeConfig?: RuntimeConfig): Server {
  const resolvedConfig = resolveRuntimeConfig(runtimeConfig);
  const handlers = buildHandlers(resolvedConfig);
  const server = new Server(
    {
      name: 'delta-engine-mcp',
      version: '1.2.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  /**
   * Tool Handlers
   */

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug('ListTools request received');
    
    return {
      tools: [
        {
          name: 'delta_run_engine',
          description:
            'Execute the Delta Engine on a bundle to verify data consensus across sources. ' +
            'Returns a DeltaReceipt with outcome (consensus/indeterminate) and round-by-round analysis.',
          inputSchema: runEngineSchema,
        },
        {
          name: 'delta_validate_bundle',
          description:
            'Check a DeltaBundle\'s structure without executing the engine — required fields, data ' +
            'types, and shape. Structural only: it says nothing about whether the evidence is sound, ' +
            'and nothing here is a hash or signature check.',
          inputSchema: validateBundleSchema,
        },
        {
          name: 'delta_verify_receipt',
          description:
            'Integrity-check a DeltaReceipt by recomputing its canonical hash. Returns `integrityOk`: ' +
            'true means the receipt has not been altered since it was produced. It does NOT mean the ' +
            'receipt was verified — no producer signature is checked here, so nothing about who ' +
            'produced it is established. (`verified` is a deprecated alias of `integrityOk`, kept for ' +
            'existing callers.) For full verification — integrity plus a producer signature that checks ' +
            'out — use verifyReceiptFull() from @uvrn/receipt; its FullVerifyResult reports `integrityOk` ' +
            'and `signatureOk` separately so the two are never conflated.',
          inputSchema: verifyReceiptSchema,
        },
        {
          name: 'delta_score_drift',
          description:
            'Score temporal drift for an already enriched DriftInputReceipt. ' +
            'Requires v_score and components; raw DeltaReceipt input is rejected.',
          inputSchema: scoreDriftSchema,
        },
        {
          name: 'delta_compare',
          description:
            'Compare exactly two already scored claim receipts. ' +
            'Requires claimId/claim_id and vScore/v_score; raw DeltaReceipt input is rejected.',
          inputSchema: compareSchema,
        },
        {
          name: 'delta_verify_identity',
          description:
            'Look up signer reputation from the in-memory MockIdentityStore. ' +
            'No external identity store or persistence is used.',
          inputSchema: verifyIdentitySchema,
        },
        {
          name: 'delta_canon_qualify',
          description:
            'Assess whether a DriftSnapshot qualifies for canon suggestion. ' +
            'Read-only: this never canonizes or writes.',
          inputSchema: canonQualifySchema,
        },
        {
          name: 'delta_canon_get',
          description:
            'Read a canon receipt by id through the configured CanonStore.read(canonId).',
          inputSchema: canonGetSchema,
        },
        {
          name: 'delta_score_claim',
          description:
            'Score a claim against evidence and return a MasterReceipt + canonical V-Score, plus a signed NetworkReceipt envelope (`networkReceipt`) and a render-ready `humanView`. Optionally pass `topic` ("domain/subject/instrument") to organize the receipt. Evidence options: (1) if you can search the web, gather sources and pass them as `sources`; (2) if you cannot, have an admin configure a connector; (3) otherwise it runs on built-in mock data. Check `evidenceMode` in the result to see which path was used (`mock` = no real evidence, low-confidence score). Per source, pass the measurement as `value` at its real magnitude (uncapped, finite) with an optional free-text `unit`; `evidenceScore` stays a 0–100 quality score, so do not rescale a real-world number into it. The result envelope carries `stanceCounts`: all five stance labels (supports/opposes/mixed/neutral/insufficient) plus quorum state and, when the quorum was missed, the reason — reported on every run, so a disagreement below quorum is visible rather than looking empty. This differs from the receipt payload\'s `stanceSummary`, which reports only support/oppose and only once the stance quorum activates; the two coexist and mean different things. `stanceCounts` is envelope-only and never enters a hashed receipt. After scoring, optional post-pipeline tools: `delta_read_support` (lattice sufficiency) then `delta_report_rank_stability` (algox ordering stability).',
          inputSchema: scoreClaimSchema,
        },
        {
          name: 'delta_read_support',
          description:
            'Post-pipeline after `delta_score_claim`: grade claim-ladder support sufficiency via lattice `readSupport`. Returns a SupportReadout (Supported/Unverified, coverage band, missing evidence classes, origin corroboration). This is coverage/sufficiency — not V-Score, not accuracy, not verification. Requires `claim` + `evidence` array (pass [] for an honest empty-coverage Unverified readout). Does not invent origins or duplicate the scoring engine.',
          inputSchema: readSupportSchema,
        },
        {
          name: 'delta_report_rank_stability',
          description:
            'Post-pipeline after support readout (optional): report which baseline ranks survive vs reorder under declared weight variants via algox `reportRankStability`. Ordering stability only — not verification, accuracy, market outcome, or publish/registry posture. Requires a non-empty `candidates` array with `label` on each entry. Default variants are an implementer PREP proposal (N=3), not product law.',
          inputSchema: reportRankStabilitySchema,
        },
        {
          name: 'delta_validate_datapoint',
          description:
            'Easy-verify a DataPoint (id/kind/value): Stage1 shape/presence → structurally-ok | malformed only. Optional explicit `runStage2` routes into existing `@uvrn/measure` when ≥2 host sources are supplied; fewer than 2 host sources with the flag on returns honest insufficient-data (success). Never emits verified. Distinct from delta_validate_bundle (bundles ≠ DataPoints) and from delta_verify_receipt (hash integrity).',
          inputSchema: validateDatapointSchema,
        },
        {
          name: 'delta_pattern_scan',
          description:
            'Observatory: scan host-supplied measurement history for PatternObservations via @uvrn/pattern. Detected ≠ verified ≠ true. Observations are not receipt-class (not hashed/signed like claim receipts). Requires non-empty `joinScope` + `window` (no silent global scan). Pass `history` as an array mapped from existing store APIs (list()/listRecords()) — or inject RuntimeConfig.patternHistoryReader; pass [] for honest insufficient. If the store-API batch read cannot answer the scoped scan, returns measured-gap / escalate (index may become required). Never emits verified patterns.',
          inputSchema: patternScanSchema,
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    logger.debug('CallTool request received', { tool: request.params.name });

    try {
      switch (request.params.name) {
        case 'delta_run_engine': {
          const result = await handlers.handleRunEngine(request.params.arguments as unknown as RunEngineInput);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'delta_validate_bundle': {
          const result = await handlers.handleValidateBundle(request.params.arguments as unknown as ValidateBundleInput);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'delta_verify_receipt': {
          const result = await handlers.handleVerifyReceipt(request.params.arguments as unknown as VerifyReceiptInput);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'delta_score_drift': {
          const result = await handlers.handleScoreDrift(request.params.arguments as unknown as ScoreDriftInput);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'delta_compare': {
          const result = await handlers.handleCompare(request.params.arguments as unknown as CompareReceiptsInput);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'delta_verify_identity': {
          const result = await handlers.handleVerifyIdentity(request.params.arguments as unknown as VerifyIdentityInput);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'delta_canon_qualify': {
          const result = await handlers.handleCanonQualify(request.params.arguments as unknown as CanonQualifyInput);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'delta_canon_get': {
          const result = await handlers.handleCanonGet(request.params.arguments as unknown as CanonGetInput);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'delta_score_claim': {
          const result = await handlers.handleScoreClaim(request.params.arguments as unknown as ScoreClaimInput);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'delta_read_support': {
          const result = await handlers.handleReadSupport(
            request.params.arguments as unknown as ReadSupportInput
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'delta_report_rank_stability': {
          const result = await handlers.handleReportRankStability(
            request.params.arguments as unknown as ReportRankStabilityInput
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'delta_validate_datapoint': {
          const result = await handlers.handleValidateDatapoint(
            request.params.arguments as unknown as ValidateDatapointInput
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'delta_pattern_scan': {
          const result = await handlers.handlePatternScan(
            request.params.arguments as unknown as PatternScanInput
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    } catch (error) {
      logger.error('Tool execution error', { error });
      
      if (error instanceof MCPError) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: error.message,
                code: error.code,
                details: error.details,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: message,
              code: 'INTERNAL_ERROR',
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  /**
   * Resource Handlers
   */

  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    logger.debug('ListResources request received');
    
    return {
      resources: [
        {
          uri: 'mcp://delta-engine/schema/bundle',
          name: 'DeltaBundle Schema',
          description: 'JSON schema for DeltaBundle structure',
          mimeType: 'application/json',
        },
        {
          uri: 'mcp://delta-engine/schema/receipt',
          name: 'DeltaReceipt Schema',
          description: 'JSON schema for DeltaReceipt structure',
          mimeType: 'application/json',
        },
        {
          uri: 'mcp://delta-engine/receipts/{uvrn}',
          name: 'Receipt by UVRN',
          description: 'Retrieve a DeltaReceipt by its UVRN (Note: Storage not yet implemented in Phase A.3)',
          mimeType: 'application/json',
        },
        {
          uri: 'mcp://delta-engine/bundles/{id}',
          name: 'Bundle by ID',
          description: 'Retrieve a DeltaBundle by its ID (Note: Storage not yet implemented in Phase A.3)',
          mimeType: 'application/json',
        },
      ],
    };
  });

  // Handle resource reads
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    logger.debug('ReadResource request received', { uri: request.params.uri });

    try {
      const data = await handleResource(request.params.uri);
      
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'application/json',
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Resource read error', { error });
      throw error;
    }
  });

  /**
   * Prompt Handlers
   */

  // List available prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    logger.debug('ListPrompts request received');
    
    const prompts = await listPrompts();
    
    return {
      prompts: prompts.map((p) => ({
        name: p.name,
        description: p.description,
        arguments: p.parameters?.map((param) => ({
          name: param,
          description: `Parameter: ${param}`,
          required: true,
        })) || [],
      })),
    };
  });

  // Handle prompt requests
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    logger.debug('GetPrompt request received', { prompt: request.params.name });

    try {
      const prompt = await getPrompt(request.params.name);
      
      // Substitute parameters if provided
      let text = prompt.template;
      if (request.params.arguments) {
        Object.entries(request.params.arguments).forEach(([key, value]) => {
          text = text.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
        });
      }

      return {
        description: prompt.description,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text,
            },
          },
        ],
      };
    } catch (error) {
      logger.error('Prompt error', { error });
      throw error;
    }
  });

  return server;
}

/**
 * Start the MCP server
 */
export async function startServer(): Promise<void> {
  logger.info('Starting Delta Engine MCP Server...');

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  logger.info('Delta Engine MCP Server started successfully');
  logger.info('Server capabilities:', {
    tools: 12,
    resources: 4,
    prompts: 3,
  });
}
