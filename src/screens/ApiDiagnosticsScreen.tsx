'use client';

import React, { useState } from 'react';
import { SignalIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { httpProbe, type HttpProbeResult } from '@/lib/httpProbe';
import { adminJsonHeaders } from '@/lib/adminClientHeaders';
import ModalConfirm from '@/components/ui/ModalConfirm';

type Preset = {
  id: string;
  label: string;
  description: string;
  method: 'GET' | 'POST';
  path: string;
  headers?: HeadersInit;
  /** POST confirma antes */
  confirm?: boolean;
};

const PRESETS: Preset[] = [
  {
    id: 'test',
    label: 'Sanidade',
    description: 'Resposta mínima da API Next.',
    method: 'GET',
    path: '/api/test',
  },
  {
    id: 'deploy-info',
    label: 'Deploy info',
    description: 'Proxy para _deploy.json do hosting público.',
    method: 'GET',
    path: '/api/deploy-info',
  },
  {
    id: 'polls',
    label: 'Polls (admin)',
    description: 'Lista enquetes — requer x-api-key (NEXT_PUBLIC_ADMIN_API_KEY).',
    method: 'GET',
    path: '/api/polls',
    headers: adminJsonHeaders(),
  },
  {
    id: 'polls-display',
    label: 'Polls display-state',
    description: 'JSON público de exibição (mesmo contrato do app).',
    method: 'GET',
    path: '/api/polls/display-state',
  },
  {
    id: 'queri-json',
    label: 'Queridômetro JSON',
    description: 'Estado + meta do último publish.',
    method: 'GET',
    path: '/api/run-queridometro?mode=json&afterLine=0',
  },
  {
    id: 'queri-post',
    label: 'Queridômetro POST',
    description: 'Executa o job até o fim (longo). Só use se souber o impacto.',
    method: 'POST',
    path: '/api/run-queridometro',
    confirm: true,
  },
];

type RowState = {
  presetId: string;
  result: HttpProbeResult;
  method: string;
  url: string;
  at: string;
};

export function ApiDiagnosticsScreen() {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [pendingPost, setPendingPost] = useState<Preset | null>(null);

  const runPreset = async (p: Preset) => {
    if (p.method === 'POST' && p.confirm) {
      setPendingPost(p);
      return;
    }
    await executePreset(p);
  };

  const executePreset = async (p: Preset) => {
    setLoadingId(p.id);
    const url = p.path.startsWith('http') ? p.path : p.path;
    const init: RequestInit =
      p.method === 'POST'
        ? { method: 'POST', headers: p.headers }
        : { method: 'GET', headers: p.headers };
    const result = await httpProbe(url, init);
    setRows((prev) => ({
      ...prev,
      [p.id]: {
        presetId: p.id,
        result,
        method: p.method,
        url: p.path,
        at: new Date().toISOString(),
      },
    }));
    setLoadingId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">Ferramentas</p>
          <h1 className="text-2xl font-bold tracking-tight text-gray-950">Diagnóstico de API</h1>
          <p className="max-w-3xl text-sm text-gray-600">
            Testes rápidos contra rotas já existentes. Nenhum endpoint novo é criado aqui — apenas chamadas do próprio
            navegador.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-4">
          {PRESETS.map((p) => {
            const row = rows[p.id];
            const loading = loadingId === p.id;
            return (
              <div
                key={p.id}
                className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <SignalIcon className="h-5 w-5 shrink-0 text-indigo-600" aria-hidden />
                      <h2 className="text-base font-semibold text-gray-900">{p.label}</h2>
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-700">
                        {p.method}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{p.description}</p>
                    <p className="mt-2 break-all font-mono text-xs text-gray-500">{p.path}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void runPreset(p)}
                    disabled={loading}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:opacity-60"
                  >
                    <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
                    Executar
                  </button>
                </div>
                {row ? (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span
                        className={`rounded-full px-2.5 py-1 font-mono font-semibold ring-1 ${
                          row.result.ok ? 'bg-green-50 text-green-900 ring-green-200' : 'bg-red-50 text-red-900 ring-red-200'
                        }`}
                      >
                        HTTP {row.result.status || '—'}
                      </span>
                      <span className="rounded-full bg-gray-50 px-2.5 py-1 font-mono text-gray-800 ring-1 ring-gray-200">
                        {row.result.ms} ms
                      </span>
                      <span className="text-gray-500">
                        {new Date(row.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}
                      </span>
                    </div>
                    {row.result.networkError ? (
                      <p className="mt-2 text-sm text-red-700">Rede: {row.result.networkError}</p>
                    ) : null}
                    <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-gray-950 p-3 text-[11px] leading-relaxed text-green-300 font-mono whitespace-pre-wrap break-words">
                      {row.result.bodySnippet || '(corpo vazio)'}
                    </pre>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </main>

      <ModalConfirm
        isOpen={Boolean(pendingPost)}
        title="Executar POST /api/run-queridometro"
        message="Isso inicia o job completo de forma síncrona e pode demorar muitos minutos. Confirme apenas em ambiente controlado."
        confirmText="Executar POST"
        confirmButtonColor="red"
        isLoading={loadingId === 'queri-post'}
        onConfirm={() => {
          const p = pendingPost;
          if (!p) return;
          setPendingPost(null);
          void executePreset(p);
        }}
        onCancel={() => loadingId !== 'queri-post' && setPendingPost(null)}
      />
    </div>
  );
}
