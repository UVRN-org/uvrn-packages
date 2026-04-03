import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ConsensusBadge } from '../src';
import { init } from '../src/umd';
import { clearBadgeCache, loadBadgeData } from '../src/runtime/badge';

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

async function flushReact(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('@uvrn/embed', () => {
  const originalFetch = global.fetch;
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    clearBadgeCache();
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    global.fetch = jest.fn();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    clearBadgeCache();
    jest.useRealTimers();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('renders the correct status label and score for STABLE', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(
      okResponse({ status: 'STABLE', vScore: 91 })
    );

    await act(async () => {
      root.render(createElement(ConsensusBadge, { claimId: 'clm_sol_001', theme: 'dark' }));
    });
    await flushReact();

    expect(container.textContent).toContain('STABLE');
    expect(container.textContent).toContain('V-Score: 91');
    expect(container.querySelector('[data-uvrn-status="STABLE"]')).not.toBeNull();
  });

  it('renders DRIFTING and CRITICAL states with the correct status attribute', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock.mockResolvedValueOnce(okResponse({ status: 'DRIFTING', vScore: 62 }));
    await act(async () => {
      root.render(createElement(ConsensusBadge, { claimId: 'clm_sol_002' }));
    });
    await flushReact();
    expect(container.textContent).toContain('DRIFTING');
    expect(container.querySelector('[data-uvrn-status="DRIFTING"]')).not.toBeNull();

    clearBadgeCache();
    fetchMock.mockResolvedValueOnce(okResponse({ status: 'CRITICAL', vScore: 38 }));
    await act(async () => {
      root.render(createElement(ConsensusBadge, { claimId: 'clm_sol_003' }));
    });
    await flushReact();
    expect(container.textContent).toContain('CRITICAL');
    expect(container.querySelector('[data-uvrn-status="CRITICAL"]')).not.toBeNull();
  });

  it('shows loading while fetch is in flight', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockImplementation(
      () => new Promise(() => {}) as Promise<Response>
    );

    await act(async () => {
      root.render(createElement(ConsensusBadge, { claimId: 'clm_sol_004' }));
    });

    expect(container.textContent).toContain('Loading...');
    expect(container.querySelector('[data-uvrn-status="loading"]')).not.toBeNull();
  });

  it('shows unavailable when fetch fails', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(new Error('offline'));

    await act(async () => {
      root.render(createElement(ConsensusBadge, { claimId: 'clm_sol_005' }));
    });
    await flushReact();

    expect(container.textContent).toContain('Unavailable');
    expect(container.querySelector('[data-uvrn-status="error"]')).not.toBeNull();
  });

  it('shows unavailable on non-ok responses', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as Response);

    await act(async () => {
      root.render(createElement(ConsensusBadge, { claimId: 'clm_sol_006' }));
    });
    await flushReact();

    expect(container.textContent).toContain('Unavailable');
  });

  it('uses the in-memory cache within cacheMs', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-02T00:00:00.000Z'));
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock.mockResolvedValue(okResponse({ status: 'STABLE', vScore: 91 }));

    const first = await loadBadgeData('clm_sol_007', 'https://api.uvrn.org', 60_000);
    const second = await loadBadgeData('clm_sol_007', 'https://api.uvrn.org', 60_000);

    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches fresh data after cacheMs expires', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-02T00:00:00.000Z'));
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce(okResponse({ status: 'STABLE', vScore: 91 }))
      .mockResolvedValueOnce(okResponse({ status: 'DRIFTING', vScore: 62 }));

    const first = await loadBadgeData('clm_sol_008', 'https://api.uvrn.org', 1_000);
    jest.setSystemTime(new Date('2026-04-02T00:00:02.000Z'));
    const second = await loadBadgeData('clm_sol_008', 'https://api.uvrn.org', 1_000);

    expect(first.vScore).toBe(91);
    expect(second.vScore).toBe(62);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('UVRN.init renders badges for data-uvrn-claim elements', async () => {
    document.body.innerHTML = `
      <div data-uvrn-claim="clm_sol_009" data-uvrn-api="https://api.example.com" data-uvrn-theme="dark"></div>
      <div data-uvrn-claim="clm_sol_010" data-uvrn-api="https://api.example.com"></div>
    `;

    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock
      .mockResolvedValueOnce(okResponse({ status: 'STABLE', vScore: 95 }))
      .mockResolvedValueOnce(okResponse({ status: 'CRITICAL', vScore: 40 }));

    await init();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain('STABLE');
    expect(document.body.textContent).toContain('CRITICAL');
  });
});
