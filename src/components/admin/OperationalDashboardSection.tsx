'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useOperationalSnapshot, type OperationalTile } from '@/hooks/useOperationalSnapshot';

function variantStyles(v: OperationalTile['variant']) {
  switch (v) {
    case 'ok':
      return {
        ring: 'ring-green-200',
        badge: 'bg-green-100 text-green-900',
        dot: 'bg-green-500',
      };
    case 'warn':
      return {
        ring: 'ring-amber-200',
        badge: 'bg-amber-100 text-amber-950',
        dot: 'bg-amber-500',
      };
    case 'error':
      return {
        ring: 'ring-red-200',
        badge: 'bg-red-100 text-red-900',
        dot: 'bg-red-500',
      };
    default:
      return {
        ring: 'ring-gray-200',
        badge: 'bg-gray-100 text-gray-800',
        dot: 'bg-gray-400',
      };
  }
}

function variantLabel(v: OperationalTile['variant']) {
  switch (v) {
    case 'ok':
      return 'OK';
    case 'warn':
      return 'Atenção';
    case 'error':
      return 'Erro';
    default:
      return 'Info';
  }
}

export function OperationalDashboardSection() {
  const { tiles, loading, refreshedAt, refresh } = useOperationalSnapshot();

  return (
    <section className="mb-12 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">Operação</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-950 sm:text-2xl">Visão rápida do sistema</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Checagens locais contra rotas já usadas pelo painel. Atualize após deploy ou quando suspeitar de falha.
          </p>
          {refreshedAt ? (
            <p className="mt-2 text-xs text-gray-500">
              Última leitura:{' '}
              {new Date(refreshedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-60"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          Atualizar
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {loading && tiles.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-gray-100 bg-gray-50 p-4 h-28"
                aria-hidden
              />
            ))
          : tiles.map((t) => {
              const s = variantStyles(t.variant);
              return (
                <div
                  key={t.id}
                  className={`rounded-xl border border-gray-100 bg-white p-4 shadow-sm ring-1 ${s.ring}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} aria-hidden />
                      <h3 className="truncate text-sm font-semibold text-gray-900">{t.title}</h3>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s.badge}`}
                    >
                      {variantLabel(t.variant)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-800 leading-snug">{t.detail}</p>
                  {t.sub ? <p className="mt-1 text-xs text-gray-500 line-clamp-2">{t.sub}</p> : null}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                    {typeof t.httpStatus === 'number' && t.httpStatus > 0 ? (
                      <span className="font-mono">HTTP {t.httpStatus}</span>
                    ) : null}
                    {typeof t.ms === 'number' ? <span className="font-mono">{t.ms} ms</span> : null}
                    {t.href ? (
                      <Link href={t.href} className="font-semibold text-indigo-600 hover:text-indigo-800">
                        Abrir →
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
      </div>
    </section>
  );
}
