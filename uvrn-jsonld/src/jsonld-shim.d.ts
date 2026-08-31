declare module 'jsonld' {
  export type DocumentLoader = (url: string) => Promise<{
    contextUrl: string | null;
    document: unknown;
    documentUrl: string;
  }>;

  export interface JsonLdOptions {
    documentLoader?: DocumentLoader;
  }

  export function expand(
    input: unknown,
    options?: JsonLdOptions,
  ): Promise<unknown[]>;

  export function frame(
    input: unknown,
    frame: unknown,
    options?: JsonLdOptions,
  ): Promise<Record<string, unknown>>;

  const jsonld: {
    expand: typeof expand;
    frame: typeof frame;
  };
  export default jsonld;
}
