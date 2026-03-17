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
import { handleRunEngine, handleValidateBundle, handleVerifyReceipt } from './tools/handlers';
import { runEngineSchema, validateBundleSchema, verifyReceiptSchema } from './tools/schemas';
import { handleResource } from './resources/handlers';
import { getPrompt, listPrompts } from './prompts/templates';
import { 
  MCPError,
  RunEngineInput,
  ValidateBundleInput,
  VerifyReceiptInput,
} from './types';

/**
 * Create and configure the MCP server
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'delta-engine-mcp',
      version: '1.0.0',
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
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    logger.debug('CallTool request received', { tool: request.params.name });

    try {
      switch (request.params.name) {
        case 'delta_run_engine': {
          const result = await handleRunEngine(request.params.arguments as unknown as RunEngineInput);
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
          const result = await handleValidateBundle(request.params.arguments as unknown as ValidateBundleInput);
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
          const result = await handleVerifyReceipt(request.params.arguments as unknown as VerifyReceiptInput);
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
 *
 * Uses stdio transport. When the transport closes (e.g. stdin closed or client
 * disconnects), the process should exit with code 0; that is handled in run.ts
 * via process.stdin.on('close').
 */
export async function startServer(): Promise<void> {
  logger.info('Starting Delta Engine MCP Server...');

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  logger.info('Delta Engine MCP Server started successfully');
  logger.info('Server capabilities:', {
    tools: 3,
    resources: 4,
    prompts: 3,
  });
}
