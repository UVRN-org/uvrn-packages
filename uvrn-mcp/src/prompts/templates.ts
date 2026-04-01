/**
 * MCP Prompt Templates
 * Provides reusable prompt templates for common Delta Engine tasks
 */

import { logger } from '../logger';

export interface PromptTemplate {
  name: string;
  description: string;
  template: string;
  parameters?: string[];
}

/**
 * Prompt: verify_data
 * Template for data verification queries
 */
export const verifyDataPrompt: PromptTemplate = {
  name: 'verify_data',
  description: 'Template for verifying data across multiple sources',
  parameters: ['claim', 'sources'],
  template: `I need to verify the following claim using Delta Engine:

Claim: {{claim}}

Please help me:
1. Create a DeltaBundle with data from these sources: {{sources}}
2. Run the delta_run_engine tool to process the bundle
3. Analyze the receipt and explain:
   - What is the consensus outcome?
   - What is the final delta between sources?
   - Are the sources in agreement within the threshold?
   - What rounds were needed to reach the outcome?

Format the bundle with appropriate thresholdPct and dataSpecs.`,
};

/**
 * Prompt: create_bundle
 * Template for bundle creation guidance
 */
export const createBundlePrompt: PromptTemplate = {
  name: 'create_bundle',
  description: 'Guide user through creating a DeltaBundle',
  parameters: ['claim'],
  template: `I want to create a DeltaBundle to verify: {{claim}}

Please guide me through:
1. What data sources should I include? (minimum 2 required)
2. What metrics should I compare across sources?
3. What threshold percentage should I use?
4. Help me structure the bundle JSON with:
   - bundleId: unique identifier
   - claim: the verification claim
   - dataSpecs: array of at least 2 data specifications
   - thresholdPct: acceptable variance (0.0 to 1.0)
   - maxRounds: optional, defaults to 5

Once we have the bundle structure, we can use delta_validate_bundle to check it before running.`,
};

/**
 * Prompt: analyze_receipt
 * Template for receipt analysis
 */
export const analyzeReceiptPrompt: PromptTemplate = {
  name: 'analyze_receipt',
  description: 'Analyze a Delta Engine receipt',
  parameters: ['receipt_json'],
  template: `Please analyze this Delta Engine receipt:

{{receipt_json}}

Help me understand:
1. What was being verified? (bundleId and sources)
2. What was the outcome? (consensus or indeterminate)
3. What was the final delta between sources?
4. How many rounds were needed?
5. For each round, what were the deltas by metric?
6. Is the receipt hash valid? (use delta_verify_receipt to check)
7. What does this tell us about data agreement across sources?

Provide a clear explanation of the verification results.`,
};

/**
 * Get prompt by name
 */
export async function getPrompt(name: string): Promise<PromptTemplate> {
  logger.debug('getPrompt called', { name });

  switch (name) {
    case 'verify_data':
      return verifyDataPrompt;
    
    case 'create_bundle':
      return createBundlePrompt;
    
    case 'analyze_receipt':
      return analyzeReceiptPrompt;
    
    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}

/**
 * List all available prompts
 */
export async function listPrompts(): Promise<PromptTemplate[]> {
  return [verifyDataPrompt, createBundlePrompt, analyzeReceiptPrompt];
}
