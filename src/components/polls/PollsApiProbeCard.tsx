'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { SignalIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { httpProbe } from '@/lib/httpProbe';
import { adminJsonHeaders } from '@/lib/adminClientHeaders';

export function PollsApiProbeCard() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [snippet, setSnippet] = useState<string>('');
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setNetworkError(null);
    setSummary(null);
    const r = await httpProbe('/api/polls', { headers: adminJsonHeaders() });
    setStatus(r.status);
    setMs(r.ms);
    setSnippet(r.bodySnippet);
    if (r.networkError) {
      setNetworkError(r.networkError);
      setSummary(null);
    } else if (r.status === 401) {
      setSummary('Chave admin inválida ou ausente no browser (NEXT_PUBLIC_ADMIN_API_KEY).');
    } else if (r.ok) {
      try {
        const arr = JSON.parse(r.bodySnippet) as unknown;
        setSummary(Array.isArray(arr) ? `${arr.length} enquete(s) no JSON` : 'JSON OK (não é array)');
      } catch {
        setSummary('Resposta não é JSON válido');
      }
    } else {
      setSummary(`Falha HTTP ${r.status}`);
    }
    setLoading(false);
  };

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <SignalIcon className="h-5 w-5 text-indigo-600 shrink-0" aria-hidden />
            Diagnóstico GET /api/polls
          </div>
          <p className="mt-1 text-xs text-gray-600">
            Mesma rota e cabeçalhos usados pela lista abaixo. Útil após deploy ou mudança de Supabase.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Testar agora
          </button>
          <Link
            href="/admin/diagnostico"
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
          >
            Diagnóstico completo
          </Link>
        </div>
      </div>
      {status !== null ? (
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-white px-2.5 py-1 font-mono font-semibold text-gray-800 ring-1 ring-gray-200">
            HTTP {status}
          </span>
          {ms !== null ? (
            <span className="rounded-full bg-white px-2.5 py-1 font-mono font-semibold text-gray-800 ring-1 ring-gray-200">
              {ms} ms
            </span>
          ) : null}
        </div>
      ) : null}
      {summary ? <p className="mt-2 text-sm font-medium text-gray-800">{summary}</p> : null}
      {networkError ? <p className="mt-2 text-sm text-red-700">Rede: {networkError}</p> : null}
      {snippet && !networkError ? (
        <pre className="mt-3 max-h-36 overflow-auto rounded-lg bg-gray-950/95 p-3 text-[11px] leading-relaxed text-green-300 font-mono whitespace-pre-wrap break-words">
          {snippet.length > 500 ? `${snippet.slice(0, 500)}…` : snippet}
        </pre>
      ) : null}
    </div>
  );
}
