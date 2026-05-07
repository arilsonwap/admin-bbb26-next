export type HttpProbeResult = {
  ok: boolean;
  status: number;
  ms: number;
  bodySnippet: string;
  networkError?: string;
};

/**
 * Fetch com medição de tempo e trecho do corpo (texto), para diagnóstico operacional no painel.
 */
export async function httpProbe(url: string, init?: RequestInit): Promise<HttpProbeResult> {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      cache: 'no-store',
    });
    const text = await res.text();
    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const ms = Math.max(0, Math.round(t1 - t0));
    const bodySnippet = text.length > 600 ? `${text.slice(0, 600)}…` : text;
    return {
      ok: res.ok,
      status: res.status,
      ms,
      bodySnippet,
    };
  } catch (e) {
    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const ms = Math.max(0, Math.round(t1 - t0));
    return {
      ok: false,
      status: 0,
      ms,
      bodySnippet: '',
      networkError: e instanceof Error ? e.message : String(e),
    };
  }
}
