'use client';

import { useCallback, useEffect, useState } from 'react';

export type QueridometroJsonState = {
  ok: boolean;
  running: boolean;
  latestPublished: Record<string, unknown> | null;
  generatedAt?: string;
  jobDir?: string;
  error?: string;
  httpStatus: number;
  fetchedAt: string;
  networkError?: string;
};

export function useQueridometroJsonPoll(intervalMs = 4000) {
  const [state, setState] = useState<QueridometroJsonState | null>(null);

  const fetchOnce = useCallback(async () => {
    const fetchedAt = new Date().toISOString();
    try {
      const res = await fetch('/api/run-queridometro?mode=json&afterLine=0', { cache: 'no-store' });
      const raw = await res.json().catch(() => null);
      const body = raw as Record<string, unknown> | null;
      setState({
        ok: Boolean(body?.ok !== false && res.ok),
        running: Boolean(body?.running),
        latestPublished: (body?.latestPublished as Record<string, unknown> | null) ?? null,
        generatedAt: typeof body?.generatedAt === 'string' ? body.generatedAt : undefined,
        jobDir: typeof body?.jobDir === 'string' ? body.jobDir : undefined,
        error: typeof body?.error === 'string' ? body.error : undefined,
        httpStatus: res.status,
        fetchedAt,
      });
    } catch (e) {
      setState({
        ok: false,
        running: false,
        latestPublished: null,
        httpStatus: 0,
        fetchedAt,
        networkError: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  useEffect(() => {
    const boot = window.setTimeout(() => void fetchOnce(), 0);
    const id = window.setInterval(() => void fetchOnce(), intervalMs);
    return () => {
      window.clearTimeout(boot);
      window.clearInterval(id);
    };
  }, [fetchOnce, intervalMs]);

  return { jsonState: state, refetchJson: fetchOnce };
}
