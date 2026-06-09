// Collapse a URL to a host+path key so trivially different URLs dedupe together.
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = stripHostPrefix(u.hostname);
    const path = u.pathname.replace(/\/+$/, '');
    return `${host}${path}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function hostOf(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    return stripHostPrefix(new URL(url).hostname).toLowerCase();
  } catch {
    const trimmed = url.trim();
    return trimmed ? stripHostPrefix(trimmed).toLowerCase() : undefined;
  }
}

function stripHostPrefix(host: string): string {
  return host.toLowerCase().replace(/^(?:www|m|amp)\./, '');
}
