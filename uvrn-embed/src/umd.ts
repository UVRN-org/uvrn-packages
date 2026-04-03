import type { BadgeProps } from './types';
import {
  DEFAULT_API_URL,
  DEFAULT_CACHE_MS,
  buildBadgeStyle,
  getBadgePresentation,
  loadBadgeData,
  resolveTheme,
} from './runtime/badge';

interface UvrnGlobal {
  init(root?: ParentNode): Promise<void[]>;
  renderBadge(element: Element, options: BadgeProps): Promise<void>;
}

function applyInlineStyles(element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.entries(styles).forEach(([key, value]) => {
    if (typeof value === 'string') {
      element.style.setProperty(
        key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`),
        value
      );
    }
  });
}

function renderState(
  element: Element,
  options: Required<Pick<BadgeProps, 'theme' | 'showScore' | 'showStatus'>>,
  state: 'loading' | 'error' | 'STABLE' | 'DRIFTING' | 'CRITICAL',
  vScore?: number
): void {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  const resolvedTheme = resolveTheme(options.theme);
  const presentation = getBadgePresentation(state, resolvedTheme, {
    data:
      vScore === undefined
        ? null
        : {
            claimId: element.getAttribute('data-uvrn-claim') ?? '',
            status: state as 'STABLE' | 'DRIFTING' | 'CRITICAL',
            vScore,
            cachedAt: Date.now(),
          },
    showScore: options.showScore,
    showStatus: options.showStatus,
  });

  element.textContent = presentation.label;
  element.setAttribute('data-uvrn-status', state);
  applyInlineStyles(element, buildBadgeStyle(resolvedTheme, presentation));
}

function readOptions(element: Element, input: BadgeProps): BadgeProps | null {
  const claimId = input.claimId || element.getAttribute('data-uvrn-claim') || '';
  if (!claimId) {
    return null;
  }

  return {
    claimId,
    apiUrl: input.apiUrl || element.getAttribute('data-uvrn-api') || DEFAULT_API_URL,
    theme: input.theme || (element.getAttribute('data-uvrn-theme') as BadgeProps['theme']) || 'auto',
    showScore: input.showScore ?? true,
    showStatus: input.showStatus ?? true,
    cacheMs: input.cacheMs ?? DEFAULT_CACHE_MS,
    className: input.className,
  };
}

export async function renderBadge(element: Element, options: BadgeProps): Promise<void> {
  const resolved = readOptions(element, options);
  if (!resolved) {
    return;
  }

  renderState(
    element,
    {
      theme: resolved.theme ?? 'auto',
      showScore: resolved.showScore ?? true,
      showStatus: resolved.showStatus ?? true,
    },
    'loading'
  );

  try {
    const data = await loadBadgeData(
      resolved.claimId,
      resolved.apiUrl ?? DEFAULT_API_URL,
      resolved.cacheMs ?? DEFAULT_CACHE_MS
    );

    renderState(
      element,
      {
        theme: resolved.theme ?? 'auto',
        showScore: resolved.showScore ?? true,
        showStatus: resolved.showStatus ?? true,
      },
      data.status,
      data.vScore
    );
  } catch {
    renderState(
      element,
      {
        theme: resolved.theme ?? 'auto',
        showScore: resolved.showScore ?? true,
        showStatus: resolved.showStatus ?? true,
      },
      'error'
    );
  }

  if (resolved.className && element instanceof HTMLElement) {
    element.classList.add(resolved.className);
  }
}

export async function init(root: ParentNode = document): Promise<void[]> {
  const elements = Array.from(root.querySelectorAll('[data-uvrn-claim]'));
  return Promise.all(elements.map((element) => renderBadge(element, { claimId: '' })));
}

declare global {
  interface Window {
    UVRN?: UvrnGlobal;
  }
}

const api: UvrnGlobal = { init, renderBadge };

if (typeof window !== 'undefined') {
  window.UVRN = api;

  const autoInit = (): void => {
    void init();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit, { once: true });
  } else {
    autoInit();
  }
}
