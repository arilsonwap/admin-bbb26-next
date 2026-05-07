'use client';

import { useCallback, useEffect, useState } from 'react';
import { httpProbe } from '@/lib/httpProbe';
import { adminJsonHeaders } from '@/lib/adminClientHeaders';

export type OperationalTile = {
  id: string;
  title: string;
  variant: 'ok' | 'warn' | 'error' | 'neutral';
  ms?: number;
  httpStatus?: number;
  detail: string;
  sub?: string;
  href?: string;
};

type QueridometroJson = {
  ok?: boolean;
  running?: boolean;
  latestPublished?: Record<string, unknown> | null;
  error?: string;
  generatedAt?: string;
};

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function useOperationalSnapshot() {
  const [tiles, setTiles] = useState<OperationalTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);

    const envLabel =
      typeof process !== 'undefined' && process.env.NODE_ENV === 'production'
        ? 'production'
        : 'development';

    const host = typeof window !== 'undefined' ? window.location.host : '';

    const [testP, deployP, pollsP, queriP] = await Promise.all([
      httpProbe('/api/test'),
      httpProbe('/api/deploy-info'),
      httpProbe('/api/polls', { headers: adminJsonHeaders() }),
      httpProbe('/api/run-queridometro?mode=json&afterLine=0'),
    ]);

    const next: OperationalTile[] = [];

    next.push({
      id: 'panel',
      title: 'API do painel',
      variant: testP.ok ? 'ok' : 'error',
      ms: testP.ms,
      httpStatus: testP.status,
      detail: testP.networkError
        ? `Rede: ${testP.networkError}`
        : testP.ok
          ? 'GET /api/test OK'
          : `Falha HTTP ${testP.status}`,
      sub: testP.bodySnippet ? testP.bodySnippet.replace(/\s+/g, ' ').slice(0, 120) : undefined,
      href: '/api/test',
    });

    next.push({
      id: 'deploy-info',
      title: 'Deploy / hosting (proxy)',
      variant: deployP.ok ? 'ok' : deployP.status >= 500 ? 'error' : 'warn',
      ms: deployP.ms,
      httpStatus: deployP.status,
      detail: deployP.networkError
        ? `Rede: ${deployP.networkError}`
        : deployP.ok
          ? 'GET /api/deploy-info OK'
          : `HTTP ${deployP.status} ao ler _deploy.json`,
      sub: deployP.ok
        ? (() => {
            const j = parseJsonSafe(deployP.bodySnippet) as { version?: string; lastDeploy?: string } | null;
            if (j?.version) return `Versão: ${j.version}`;
            return deployP.bodySnippet.slice(0, 100);
          })()
        : deployP.bodySnippet.slice(0, 120),
      href: '/api/deploy-info',
    });

    let pollsDetail = '';
    let pollsVariant: OperationalTile['variant'] = pollsP.ok ? 'ok' : 'error';
    if (pollsP.networkError) {
      pollsDetail = `Rede: ${pollsP.networkError}`;
    } else if (pollsP.status === 401) {
      pollsVariant = 'warn';
      pollsDetail = '401 — confira NEXT_PUBLIC_ADMIN_API_KEY no build';
    } else if (pollsP.ok) {
      const parsed = parseJsonSafe(pollsP.bodySnippet);
      const n = Array.isArray(parsed) ? parsed.length : null;
      pollsDetail = n !== null ? `${n} enquete(s) na lista` : 'Resposta OK (formato inesperado)';
    } else {
      pollsDetail = `HTTP ${pollsP.status}`;
    }

    next.push({
      id: 'polls',
      title: 'GET /api/polls',
      variant: pollsVariant,
      ms: pollsP.ms,
      httpStatus: pollsP.status,
      detail: pollsDetail,
      href: '/polls',
    });

    const qj = parseJsonSafe(queriP.bodySnippet) as QueridometroJson | null;
    let queriDetail = '';
    let queriVariant: OperationalTile['variant'] = 'neutral';
    if (queriP.networkError) {
      queriDetail = `Rede: ${queriP.networkError}`;
      queriVariant = 'error';
    } else if (!queriP.ok) {
      queriDetail = `HTTP ${queriP.status}`;
      queriVariant = 'error';
    } else if (qj && qj.ok === false) {
      queriDetail = qj.error || 'Estado JSON com erro';
      queriVariant = 'error';
    } else {
      const running = Boolean(qj?.running);
      queriDetail = running ? 'Job em execução no servidor' : 'Ocioso (nenhum job ativo)';
      queriVariant = running ? 'warn' : 'ok';
      const lp = qj?.latestPublished;
      if (lp && typeof lp === 'object') {
        const lm = lp.lastModified ?? lp.localDate;
        if (typeof lm === 'string') {
          queriDetail += ` · último artefato: ${lm}`;
        }
      }
    }

    next.push({
      id: 'queridometro',
      title: 'Queridômetro (JSON)',
      variant: queriVariant,
      ms: queriP.ms,
      httpStatus: queriP.status,
      detail: queriDetail,
      href: '/queridometro',
    });

    next.push({
      id: 'env',
      title: 'Ambiente',
      variant: 'neutral',
      detail: `NODE_ENV=${envLabel}`,
      sub: host ? `Host: ${host}` : undefined,
    });

    setTiles(next);
    setRefreshedAt(new Date().toISOString());
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(t);
  }, [refresh]);

  return { tiles, loading, refreshedAt, refresh };
}
