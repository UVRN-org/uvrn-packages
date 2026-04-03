import type { FarmSource, NormalizationProfile, NormalizationResult, NormalizedSource } from '../types';
import { NormalizationProfiles } from '../profiles';
import { normalizeRegistrationKey, tokenizeRegistrationKey } from './transformers/utils';

type SourceTransformer = (source: FarmSource) => NormalizedSource;

type NormalizeFunction = {
  (sources: FarmSource[], profile: NormalizationProfile | keyof typeof NormalizationProfiles): NormalizationResult;
  registerTransformer(sourceName: string, transformer: SourceTransformer): void;
  getTransformer(sourceName: string): SourceTransformer | undefined;
};

const transformerRegistry = new Map<string, SourceTransformer>();

const PROVIDER_ALIASES: Record<string, string[]> = {
  coingeckofarm: ['coingecko'],
  coinbasefarm: ['coinbase'],
  newsapifarm: ['newsapi', 'newsapi.org'],
  perplexityfarm: ['perplexity'],
};

function resolveProfile(
  profile: NormalizationProfile | keyof typeof NormalizationProfiles
): NormalizationProfile {
  if (typeof profile !== 'string') {
    return profile;
  }

  const resolved = NormalizationProfiles[profile];

  if (!resolved) {
    throw new Error(`Unknown normalization profile: ${profile}`);
  }

  return resolved;
}

function findTransformer(source: FarmSource): [string, SourceTransformer] | undefined {
  for (const entry of transformerRegistry.entries()) {
    if (matchesSource(entry[0], source)) {
      return entry;
    }
  }

  return undefined;
}

function matchesSource(sourceName: string, source: FarmSource): boolean {
  const normalizedKey = normalizeRegistrationKey(sourceName);
  const aliases = PROVIDER_ALIASES[normalizedKey] ?? [];
  const haystack = `${source.url} ${source.title} ${source.snippet}`.toLowerCase();

  if (aliases.some((alias) => haystack.includes(alias))) {
    return true;
  }

  const tokens = tokenizeRegistrationKey(sourceName);

  return tokens.length > 0 && tokens.every((token) => haystack.includes(token));
}

function finalizeSource(
  source: FarmSource,
  profile: NormalizationProfile,
  match: [string, SourceTransformer] | undefined
): NormalizedSource {
  const rawResult = match == null ? profile.transform(source) : match[1](source);

  return {
    name: rawResult.name || match?.[0] || source.title,
    value: rawResult.value ?? null,
    unit: rawResult.unit || 'text',
    timestamp: Number.isFinite(rawResult.timestamp) ? rawResult.timestamp : profile.normalizeTimestamp(source.publishedAt),
    credibility: Math.max(0, Math.min(1, rawResult.credibility)),
    rawData: rawResult.rawData ?? source,
    normalizer: rawResult.normalizer || match?.[0] || profile.name,
  };
}

const normalizeImpl = (
  sources: FarmSource[],
  profile: NormalizationProfile | keyof typeof NormalizationProfiles
): NormalizationResult => {
  const resolvedProfile = resolveProfile(profile);

  return {
    sources: sources.map((source) => finalizeSource(source, resolvedProfile, findTransformer(source))),
    profile: resolvedProfile.name,
    timestamp: Date.now(),
  };
};

export const normalize = normalizeImpl as NormalizeFunction;

normalize.registerTransformer = (sourceName: string, transformer: SourceTransformer): void => {
  transformerRegistry.set(sourceName, transformer);
};

normalize.getTransformer = (sourceName: string): SourceTransformer | undefined => {
  return transformerRegistry.get(sourceName);
};
