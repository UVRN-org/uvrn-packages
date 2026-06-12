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
  runEngineSchema,
  scoreClaimSchema,
  scoreDriftSchema,
  validateBundleSchema,
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
  ValidateBundleInput,
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
            'Validate a DeltaBundle structure without executing the engine. ' +
            'Checks required fields, data types, and structural integrity.',
          inputSchema: validateBundleSchema,
        },
        {
          name: 'delta_verify_receipt',
          description:
            'Verify the integrity of a DeltaReceipt by recomputing its hash. ' +
            'Ensures the receipt has not been tampered with.',
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
            'Score a claim against evidence and return a verifiable MasterReceipt + canonical V-Score, plus a signed NetworkReceipt envelope (`networkReceipt`) and a render-ready `humanView`. Optionally pass `topic` ("domain/subject/instrument") to organize the receipt. Evidence options: (1) if you can search the web, gather sources and pass them as `sources`; (2) if you cannot, have an admin configure a connector; (3) otherwise it runs on built-in mock data. Check `evidenceMode` in the result to see which path was used (`mock` = no real evidence, low-confidence score).',
          inputSchema: scoreClaimSchema,
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
    tools: 9,
    resources: 4,
    prompts: 3,
  });
}
