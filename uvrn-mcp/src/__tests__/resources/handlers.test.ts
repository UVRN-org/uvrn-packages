import {
  getBundleSchema,
  getReceiptSchema,
  getReceiptByUvrn,
  getBundleById,
  parseResourceUri,
  handleResource,
} from '../../resources/handlers';
import { ResourceNotFoundError } from '../../types';

describe('Resource Handlers', () => {
  it('should return bundle schema', async () => {
    const schema = await getBundleSchema();
    expect(schema).toBeDefined();
    expect((schema as { properties?: unknown }).properties).toBeDefined();
  });

  it('should return receipt schema', async () => {
    const schema = await getReceiptSchema();
    expect(schema).toBeDefined();
  });

  it('should throw ResourceNotFoundError for receipt retrieval', async () => {
    await expect(getReceiptByUvrn('test-uvrn')).rejects.toThrow(ResourceNotFoundError);
  });

  it('should throw ResourceNotFoundError for bundle retrieval', async () => {
    await expect(getBundleById('test-id')).rejects.toThrow(ResourceNotFoundError);
  });

  it('should parse resource URIs correctly', () => {
    expect(parseResourceUri('mcp://delta-engine/schema/bundle')).toEqual({ type: 'schema-bundle' });
    expect(parseResourceUri('mcp://delta-engine/receipts/abc123')).toEqual({
      type: 'receipt',
      id: 'abc123',
    });
  });

  it('should route schema resource reads', async () => {
    const schema = await handleResource('mcp://delta-engine/schema/bundle');
    expect(schema).toBeDefined();
  });

  it('should throw for invalid resource URI', async () => {
    await expect(handleResource('mcp://delta-engine/invalid')).rejects.toThrow(ResourceNotFoundError);
  });
});
