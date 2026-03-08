import { getPrompt, listPrompts } from '../../prompts/templates';

describe('Prompt Templates', () => {
  it('should list all prompts', async () => {
    const prompts = await listPrompts();
    expect(prompts).toHaveLength(3);
    expect(prompts.map((p) => p.name)).toContain('verify_data');
  });

  it('should get prompt by name', async () => {
    const prompt = await getPrompt('verify_data');
    expect(prompt).toBeDefined();
    expect(prompt.template).toContain('{{claim}}');
  });

  it('should throw error for unknown prompt', async () => {
    await expect(getPrompt('unknown')).rejects.toThrow();
  });
});
