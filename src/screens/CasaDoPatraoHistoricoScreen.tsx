'use client';

import React from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  LinkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { adminJsonHeaders } from '@/lib/adminClientHeaders';
import type { CasaDoPatraoHistoricoEvent, CasaDoPatraoSuggestedAction } from '@/utils/casaDoPatraoHistorico';

const PREVIEW_API = '/api/admin/casa-do-patrao/historico/preview';
const CONFIRM_CYCLE_API = '/api/admin/casa-do-patrao/historico/confirm-cycle';
const CONFIRM_EVENTS_API = '/api/admin/casa-do-patrao/historico/confirm-events';
const REBUILD_API = '/api/admin/casa-do-patrao/historico/rebuild';
const PUBLISH_API = '/api/admin/casa-do-patrao/historico/publish';
const SPECIAL_EVENT_API = '/api/admin/casa-do-patrao/historico/special-event';
const LAST_SPECIAL_EVENT_SESSION_KEY = 'casaDoPatraoHistorico.lastSpecialEvent.v1';

type LastSpecialEventStored = { label: string; atIso: string };

function readLastSpecialEventFromSession(): LastSpecialEventStored | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(LAST_SPECIAL_EVENT_SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== 'object') return null;
    const label = (p as { label?: unknown }).label;
    const atIso = (p as { atIso?: unknown }).atIso;
    if (typeof label !== 'string' || typeof atIso !== 'string') return null;
    return { label, atIso };
  } catch {
    return null;
  }
}

function writeLastSpecialEventToSession(value: LastSpecialEventStored) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(LAST_SPECIAL_EVENT_SESSION_KEY, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

const HISTORICO_COUNTER_COLS: { field: string; label: string; title?: string }[] = [
  { field: 'casaDoPatrao', label: 'casaDoPatrao' },
  { field: 'casaDoTrampo', label: 'casaDoTrampo' },
  { field: 'patrao', label: 'patrao' },
  { field: 'parca', label: 'parca' },
  { field: 'cozinha', label: 'cozinha' },
  { field: 'louca', label: 'louca' },
  { field: 'banheiro', label: 'banheiro' },
  { field: 'lavanderia', label: 'lavanderia' },
  { field: 'servir', label: 'servir' },
  { field: 'faxina', label: 'faxina' },
  {
    field: 'promovidoDoTrampoParaParca',
    label: 'Promov.→Parça',
    title: 'promovidoDoTrampoParaParca',
  },
  {
    field: 'promovidoDoTrampoParaPatrao',
    label: 'Promov.→Patrão',
    title: 'promovidoDoTrampoParaPatrao',
  },
  { field: 'provaToFora', label: 'Prova Tô Fora' },
  { field: 'foraDoJogo', label: 'foraDoJogo' },
  { field: 'poderDoVoto', label: 'Poder do Voto' },
  { field: 'taNaReta', label: 'Tá na Reta' },
];

const STATUS_LABEL: Record<CasaDoPatraoSuggestedAction, string> = {
  SEM_MUDANCAS: 'Sem mudanças',
  EVENTO_DENTRO_CICLO: 'Evento dentro do ciclo',
  NOVO_CICLO_SUGERIDO: 'Novo ciclo sugerido',
  ATENCAO: 'Atenção',
  PRIMEIRO_CICLO: 'Primeiro ciclo',
};

interface PreviewPayload {
  history: {
    currentCycleId: string | null;
    cycles: {
      id: string;
      numero?: number;
      patraoNome: string;
      patraoKey: string;
      status: string;
      isPlaceholder?: boolean;
      placeholderNote?: string;
    }[];
    participants: {
      nome: string;
      key: string;
      statusAtual: string;
      funcaoAtual: string;
      grupoAtual: string;
      historico: Record<string, number>;
    }[];
  };
  diff: {
    functionChanges: number;
    groupChanges: number;
    patraoChanged: boolean;
    rows: {
      participanteNome: string;
      funcaoAnterior: string | null;
      grupoAnterior: string | null;
      funcaoAtual: string;
      grupoAtual: string;
      tipoMudanca: string;
      acaoSugerida: string;
    }[];
  };
  suggestedAction: CasaDoPatraoSuggestedAction;
  suggestedEvents: CasaDoPatraoHistoricoEvent[];
  warnings: string[];
  patraoDetected: { key: string | null; nome: string | null };
  lastCycle: {
    id: string;
    numero?: number;
    patraoKey: string;
    patraoNome: string;
    status?: string;
    isPlaceholder?: boolean;
  } | null;
  activeCycle?: {
    id: string;
    numero: number;
    status: string;
    isPlaceholder: boolean;
    placeholderNote: string | null;
    patraoNome: string;
    patraoKey: string;
  } | null;
  sourceMeta?: {
    participantesUpdatedAt: string | null;
    barraUpdatedAt: string | null;
    historicoUpdatedAt: string | null;
    historicoExists: boolean;
    paths: { participantes: string; barra: string; historico: string };
  };
  activeSnapshot?: {
    key: string;
    nome: string;
    funcao?: string;
    grupo?: string;
    statusAtual?: string;
  }[];
}

function formatSpecialEventInstant(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function StatusPill({ action }: { action: CasaDoPatraoSuggestedAction }) {
  const colors: Record<CasaDoPatraoSuggestedAction, string> = {
    SEM_MUDANCAS: 'bg-slate-100 text-slate-800 border-slate-200',
    EVENTO_DENTRO_CICLO: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    NOVO_CICLO_SUGERIDO: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    ATENCAO: 'bg-amber-50 text-amber-900 border-amber-200',
    PRIMEIRO_CICLO: 'bg-blue-50 text-blue-800 border-blue-200',
  };
  return (
    <span
      className={`inline-flex rounded-md border px-3 py-1 text-sm font-medium ${colors[action]}`}
    >
      {STATUS_LABEL[action]}
    </span>
  );
}

export const CasaDoPatraoHistoricoScreen: React.FC = () => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<PreviewPayload | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [selectedParticipantKey, setSelectedParticipantKey] = React.useState<string | null>(null);
  const [isHistoricoAggregadoOpen, setIsHistoricoAggregadoOpen] = React.useState(false);
  const [selectedEvents, setSelectedEvents] = React.useState<Set<string>>(new Set());
  const [powerParticipantKey, setPowerParticipantKey] = React.useState('');
  const [powerNote, setPowerNote] = React.useState('');
  const [indicadorKey, setIndicadorKey] = React.useState('');
  const [targetTaNaRetaKey, setTargetTaNaRetaKey] = React.useState('');
  const [indicatedNote, setIndicatedNote] = React.useState('');
  const [taNaRetaSelected, setTaNaRetaSelected] = React.useState<Set<string>>(new Set());
  const [taNaRetaNote, setTaNaRetaNote] = React.useState('');
  const [confirmTaNaRetaFora, setConfirmTaNaRetaFora] = React.useState(false);
  const [lastSpecialEvent, setLastSpecialEvent] = React.useState<LastSpecialEventStored | null>(() =>
    readLastSpecialEventFromSession()
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(PREVIEW_API, { headers: adminJsonHeaders(), cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setData(j as PreviewPayload);
      const suggestions = (j as PreviewPayload).suggestedEvents ?? [];
      setSelectedEvents(new Set(suggestions.map((e: CasaDoPatraoHistoricoEvent) => e.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const toggleEvent = (id: string) => {
    setSelectedEvents((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const postJson = async (url: string, body?: object) => {
    setBusy(url);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: adminJsonHeaders(),
        body: body ? JSON.stringify(body) : '{}',
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setMsg('Operação concluída. Recarregando…');
      await load();
      setMsg('Concluído.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na requisição');
    } finally {
      setBusy(null);
    }
  };

  const lastPatrao = data?.lastCycle?.patraoNome ?? '—';

  const cyclesSortedUi = React.useMemo(() => {
    const rows = data?.history.cycles ?? [];
    return [...rows].sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));
  }, [data?.history.cycles]);

  const selectedParticipant = React.useMemo(() => {
    if (!selectedParticipantKey) return null;
    return data?.history.participants.find((p) => p.key === selectedParticipantKey) ?? null;
  }, [data?.history.participants, selectedParticipantKey]);

  const snapChoices = React.useMemo(() => {
    const list = data?.activeSnapshot ?? [];
    return [...list].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [data?.activeSnapshot]);

  const summarizeSpecialPayload = React.useCallback(
    (payload: Record<string, unknown>) => {
      const nameOf = (k: string) => snapChoices.find((s) => s.key === k)?.nome ?? k;
      const kind = payload.kind;
      if (kind === 'power_vote_owner') {
        const key = String(payload.participanteKey ?? '');
        return `Dono do Poder do Voto · ${nameOf(key)}`;
      }
      if (kind === 'indicated_ta_na_reta') {
        const indicador = String(payload.participanteKey ?? '');
        const indicado = String(payload.targetParticipanteKey ?? '');
        return `Indicação ao Tá na Reta · ${nameOf(indicador)} → ${nameOf(indicado)}`;
      }
      if (kind === 'ta_na_reta') {
        const keys = Array.isArray(payload.participanteKeys) ? payload.participanteKeys.map(String) : [];
        const names = keys.map(nameOf).join(', ');
        return `Tá na Reta (${keys.length}) · ${names}`;
      }
      return `Evento · ${String(kind ?? '—')}`;
    },
    [snapChoices]
  );

  const postSpecialEvent = React.useCallback(
    async (payload: Record<string, unknown>) => {
      setBusy(SPECIAL_EVENT_API);
      setMsg(null);
      setError(null);
      try {
        const res = await fetch(SPECIAL_EVENT_API, {
          method: 'POST',
          headers: adminJsonHeaders(),
          body: JSON.stringify(payload),
        });
        const j = (await res.json()) as {
          error?: string;
          code?: string;
          warnings?: string[];
          ok?: boolean;
          accepted?: number;
          duplicateKeys?: string[];
        };
        if (res.status === 422 && j.code === 'NEEDS_CONFIRM_FORA') {
          setError(j.error ?? 'Marque a confirmação para participantes fora do jogo no snapshot.');
          return;
        }
        if (!res.ok) {
          throw new Error(j.error || res.statusText);
        }
        const stored: LastSpecialEventStored = {
          label: summarizeSpecialPayload(payload),
          atIso: new Date().toISOString(),
        };
        writeLastSpecialEventToSession(stored);
        setLastSpecialEvent(stored);
        const warn = j.warnings?.length ? ` Avisos: ${j.warnings.join('; ')}` : '';
        if (payload.kind === 'ta_na_reta' && j.accepted != null) {
          const dup =
            j.duplicateKeys && j.duplicateKeys.length > 0
              ? ` Duplicados ignorados neste ciclo: ${j.duplicateKeys.join(', ')}.`
              : '';
          setMsg(`Registados ${j.accepted} evento(s) TA_NA_RETA.${dup}${warn}`);
          setTaNaRetaSelected(new Set());
          setTaNaRetaNote('');
          setConfirmTaNaRetaFora(false);
        } else if (j.warnings?.length) {
          setMsg(`Guardado com avisos: ${j.warnings.join('; ')}`);
        } else {
          setMsg('Evento especial registado.');
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha ao registar');
      } finally {
        setBusy(null);
      }
    },
    [load, summarizeSpecialPayload]
  );

  const selectedTaNaRetaFora = React.useMemo(() => {
    const out: string[] = [];
    for (const s of snapChoices) {
      if (!taNaRetaSelected.has(s.key)) continue;
      if (s.grupo === 'FORA_DO_JOGO' || s.statusAtual === 'FORA_DO_JOGO') {
        out.push(s.key);
      }
    }
    return out;
  }, [snapChoices, taNaRetaSelected]);

  const toggleTaNaReta = (key: string) => {
    setTaNaRetaSelected((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  React.useEffect(() => {
    if (selectedTaNaRetaFora.length === 0) setConfirmTaNaRetaFora(false);
  }, [selectedTaNaRetaFora.length]);

  React.useEffect(() => {
    if (selectedParticipantKey && !selectedParticipant) {
      setSelectedParticipantKey(null);
    }
  }, [selectedParticipantKey, selectedParticipant]);

  React.useEffect(() => {
    if (!selectedParticipantKey) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedParticipantKey(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedParticipantKey]);

  const hasActiveCycle = Boolean(data?.history.currentCycleId);

  const canConfirmCycle =
    data &&
    (data.suggestedAction === 'NOVO_CICLO_SUGERIDO' ||
      data.suggestedAction === 'PRIMEIRO_CICLO');
  const canConfirmEvents =
    data &&
    (data.suggestedAction === 'EVENTO_DENTRO_CICLO' || data.suggestedAction === 'ATENCAO') &&
    data.history.currentCycleId;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-xl font-semibold text-gray-900">Casa do Patrão · Histórico / Ciclos</h1>
          <p className="text-sm text-gray-600 mt-1">
            Compare JSON atual com o último ciclo, revise sugestões e confirme antes de gravar.
          </p>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => void load()}
            disabled={!!busy || loading}
            className="inline-flex items-center gap-2 rounded-md bg-white border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Recarregar dados
          </button>
          <button
            type="button"
            onClick={() => void postJson(REBUILD_API)}
            disabled={!!busy || loading}
            className="inline-flex items-center gap-2 rounded-md bg-white border border-amber-300 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50"
          >
            Recalcular histórico (rebuild)
          </button>
          <button
            type="button"
            onClick={() => void postJson(PUBLISH_API)}
            disabled={!!busy || loading}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-3 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            Publicar histórico
          </button>
          <a
            href="/api/hosting-public/casa-do-patrao-historico.json"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
          >
            <LinkIcon className="h-4 w-4" /> Ver JSON publicado
          </a>
          <a
            href="/api/hosting-public/casa-do-patrao-historico-latest.json"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
          >
            <DocumentTextIcon className="h-4 w-4" /> Latest
          </a>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {msg && !error && (
          <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 shrink-0" />
            {msg}
          </div>
        )}

        {loading && (
          <div className="text-sm text-gray-600">Carregando preview…</div>
        )}

        {!loading && data && (
          <>
            <div className="rounded-lg border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-950 space-y-1">
              <p>
                <strong>Histórico válido a partir do primeiro ciclo registado.</strong> Totais e
                eventos anteriores à primeira confirmação aqui não entram neste ficheiro.
              </p>
              {data.history.cycles.length === 0 && (
                <p className="text-blue-900/90">Ainda não há ciclos confirmados — o estado atual é só leitura / preview.</p>
              )}
            </div>

            {data.activeCycle?.isPlaceholder && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 space-y-1">
                <div className="font-semibold flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
                  Ciclo activo é placeholder temporário ({data.activeCycle.id})
                </div>
                <p className="text-amber-900/95">
                  <strong>Não conta como semana oficial</strong> nem em totais nem na numeração. Use «Confirmar novo ciclo»
                  para aplicar os JSON actualizados ({data.activeCycle.id} será a <strong>semana oficial 2</strong>, sem criar ciclo‑003).
                </p>
                {data.activeCycle.placeholderNote && (
                  <p className="text-xs text-amber-900 italic">{data.activeCycle.placeholderNote}</p>
                )}
              </div>
            )}

            {data.sourceMeta && (
              <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-800">
                <div className="font-semibold text-gray-900 mb-2">Origem dos ficheiros (só leitura)</div>
                <ul className="space-y-1 font-mono text-xs break-all">
                  <li>
                    Participantes: <span className="text-gray-600">{data.sourceMeta.paths.participantes}</span>
                    {data.sourceMeta.participantesUpdatedAt && (
                      <span className="text-gray-500"> · mtime {data.sourceMeta.participantesUpdatedAt}</span>
                    )}
                  </li>
                  <li>
                    Barra: <span className="text-gray-600">{data.sourceMeta.paths.barra}</span>
                    {data.sourceMeta.barraUpdatedAt && (
                      <span className="text-gray-500"> · mtime {data.sourceMeta.barraUpdatedAt}</span>
                    )}
                  </li>
                  <li>
                    Histórico (data): <span className="text-gray-600">{data.sourceMeta.paths.historico}</span>
                    {data.sourceMeta.historicoExists && data.sourceMeta.historicoUpdatedAt && (
                      <span className="text-gray-500"> · mtime {data.sourceMeta.historicoUpdatedAt}</span>
                    )}
                    {!data.sourceMeta.historicoExists && (
                      <span className="text-amber-700"> · ficheiro ausente (será criado ao gravar)</span>
                    )}
                  </li>
                </ul>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-xs uppercase text-gray-500">Ciclo actual (activo registrado)</div>
                <div className="mt-1 text-lg font-semibold text-gray-900">
                  {data.history.currentCycleId ?? '—'}
                </div>
                {data.activeCycle?.isPlaceholder && (
                  <p className="mt-2 text-[11px] text-amber-800 font-medium">Marcado como placeholder (temporário)</p>
                )}
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-xs uppercase text-gray-500">Patrão (último ciclo)</div>
                <div className="mt-1 text-lg font-semibold text-gray-900">{lastPatrao}</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-xs uppercase text-gray-500">Patrôa detectada (JSON)</div>
                <div className="mt-1 text-lg font-semibold text-gray-900">
                  {data.patraoDetected.nome ?? '—'}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-xs uppercase text-gray-500">Mudanças (funções / grupos)</div>
                <div className="mt-1 text-lg font-semibold text-gray-900">
                  {data.diff.functionChanges} / {data.diff.groupChanges}
                </div>
                <div className="mt-3">
                  <StatusPill action={data.suggestedAction} />
                </div>
              </div>
            </div>

            {cyclesSortedUi.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-900">
                  Ciclos no ficheiro
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-3 py-2">ID</th>
                        <th className="px-3 py-2">Nº</th>
                        <th className="px-3 py-2">Estado</th>
                        <th className="px-3 py-2">Patrão</th>
                        <th className="px-3 py-2">Oficial?</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cyclesSortedUi.map((c) => (
                        <tr key={c.id}>
                          <td className="px-3 py-2 font-mono text-xs">{c.id}</td>
                          <td className="px-3 py-2">{c.numero ?? '—'}</td>
                          <td className="px-3 py-2">{c.status}</td>
                          <td className="px-3 py-2">{c.patraoNome}</td>
                          <td className="px-3 py-2">
                            {c.isPlaceholder ? (
                              <span className="rounded bg-slate-200 text-slate-800 px-2 py-0.5 text-xs">Placeholder</span>
                            ) : (
                              <span className="text-emerald-800 text-xs font-medium">Oficial</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {data.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-2 text-amber-900 font-medium text-sm">
                  <ExclamationTriangleIcon className="h-5 w-5 shrink-0" /> Atenção
                </div>
                <ul className="mt-2 list-disc pl-5 text-sm text-amber-900 space-y-1">
                  {data.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-4 space-y-4">
              <h2 className="font-semibold text-violet-950">Eventos manuais / especiais</h2>
              <p className="text-xs text-violet-900">
                Não alteram casa nem função; só atualizam contadores <strong>Poder do Voto</strong> e{' '}
                <strong>Tá na Reta</strong>. Ciclo atual:{' '}
                <strong>{data.history.currentCycleId ?? '—'}</strong>. Participantes carregados do{' '}
                <em>snapshot do ciclo activo</em>.
              </p>
              {!hasActiveCycle ? (
                <p className="text-sm text-amber-800">Confirme um ciclo antes de registar estes eventos.</p>
              ) : snapChoices.length === 0 ? (
                <p className="text-sm text-amber-800">
                  Snapshot do ciclo está vazio — não é possível validar participantes contra o ciclo actual.
                </p>
              ) : (
                <>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2 rounded-md border border-violet-200 bg-white p-3">
                    <div className="font-medium text-gray-900">1. Dono do Poder do Voto</div>
                    <label className="block text-xs text-gray-600">Participante</label>
                    <select
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      value={powerParticipantKey}
                      onChange={(e) => setPowerParticipantKey(e.target.value)}
                      disabled={!!busy || !hasActiveCycle}
                    >
                      <option value="">— Escolha —</option>
                      {snapChoices.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                    <label className="block text-xs text-gray-600">Observação (opcional)</label>
                    <input
                      type="text"
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      placeholder="ex.: semana 1"
                      value={powerNote}
                      onChange={(e) => setPowerNote(e.target.value)}
                      disabled={!!busy}
                    />
                    <button
                      type="button"
                      disabled={!!busy || !powerParticipantKey}
                      onClick={() =>
                        void postSpecialEvent({
                          kind: 'power_vote_owner',
                          participanteKey: powerParticipantKey,
                          note: powerNote.trim() || undefined,
                        })
                      }
                      className="mt-1 rounded-md bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
                    >
                      Adicionar Dono do Poder do Voto
                    </button>
                  </div>
                  <div className="space-y-2 rounded-md border border-violet-200 bg-white p-3">
                    <div className="font-medium text-gray-900">2. Indicado ao Tá na Reta</div>
                    <label className="block text-xs text-gray-600">Quem indicou (Dono do Poder do Voto)</label>
                    <select
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      value={indicadorKey}
                      onChange={(e) => setIndicadorKey(e.target.value)}
                      disabled={!!busy || !hasActiveCycle}
                    >
                      <option value="">— Escolha —</option>
                      {snapChoices.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                    <label className="block text-xs text-gray-600">Participante indicado</label>
                    <select
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      value={targetTaNaRetaKey}
                      onChange={(e) => setTargetTaNaRetaKey(e.target.value)}
                      disabled={!!busy || !hasActiveCycle}
                    >
                      <option value="">— Escolha —</option>
                      {snapChoices.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                    {(indicadorKey && targetTaNaRetaKey && indicadorKey === targetTaNaRetaKey) && (
                      <p className="text-xs text-amber-700">Indicador e indicado são a mesma pessoa — confirme se é intencional.</p>
                    )}
                    <label className="block text-xs text-gray-600">Observação (opcional)</label>
                    <input
                      type="text"
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      placeholder="ex.: Indicação pelo Poder do Voto"
                      value={indicatedNote}
                      onChange={(e) => setIndicatedNote(e.target.value)}
                      disabled={!!busy}
                    />
                    <button
                      type="button"
                      disabled={!!busy || !indicadorKey || !targetTaNaRetaKey}
                      onClick={() =>
                        void postSpecialEvent({
                          kind: 'indicated_ta_na_reta',
                          participanteKey: indicadorKey,
                          targetParticipanteKey: targetTaNaRetaKey,
                          note: indicatedNote.trim() || undefined,
                        })
                      }
                      className="mt-1 rounded-md bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
                    >
                      Adicionar indicação ao Tá na Reta
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-3 rounded-md border border-violet-200 bg-white p-3">
                  <div className="font-medium text-gray-900">3. Tá na Reta (formação / berlinda)</div>
                  <p className="text-xs text-gray-600">
                    Um evento <code className="bg-gray-100 px-0.5 rounded text-[10px]">TA_NA_RETA</code> por
                    participante. No mesmo ciclo, cada um conta no máximo +1 em{' '}
                    <strong>historico.taNaReta</strong> (registos repetidos são ignorados).
                  </p>
                  <fieldset className="space-y-2">
                    <legend className="text-xs text-gray-600 sr-only">Participantes no Tá na Reta</legend>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 max-h-48 overflow-auto border border-gray-100 rounded-md p-2">
                      {snapChoices.map((s) => (
                        <label key={`tnr-${s.key}`} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={taNaRetaSelected.has(s.key)}
                            disabled={!!busy}
                            onChange={() => toggleTaNaReta(s.key)}
                          />
                          <span>{s.nome}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="block text-xs text-gray-600">Observação (opcional)</label>
                  <input
                    type="text"
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    placeholder="ex.: Tá na Reta - semana 1"
                    value={taNaRetaNote}
                    onChange={(e) => setTaNaRetaNote(e.target.value)}
                    disabled={!!busy}
                  />
                  {selectedTaNaRetaFora.length > 0 && (
                    <label className="flex items-start gap-2 text-sm text-amber-900">
                      <input
                        type="checkbox"
                        className="mt-1 rounded border-amber-400"
                        checked={confirmTaNaRetaFora}
                        onChange={(e) => setConfirmTaNaRetaFora(e.target.checked)}
                        disabled={!!busy}
                      />
                      <span>
                        Confirmo cadastro retroativo: {selectedTaNaRetaFora.length} participante(s) selecionado(s){' '}
                        estão fora do jogo no snapshot deste ciclo (berlinda de semana anterior, etc.).
                      </span>
                    </label>
                  )}
                  <button
                    type="button"
                    disabled={
                      !!busy ||
                      taNaRetaSelected.size === 0 ||
                      (selectedTaNaRetaFora.length > 0 && !confirmTaNaRetaFora)
                    }
                    onClick={() =>
                      void postSpecialEvent({
                        kind: 'ta_na_reta',
                        participanteKeys: [...taNaRetaSelected],
                        note: taNaRetaNote.trim() || undefined,
                        confirmForaDoJogo:
                          selectedTaNaRetaFora.length > 0 ? confirmTaNaRetaFora : undefined,
                      })
                    }
                    className="rounded-md bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
                  >
                    Adicionar Tá na Reta
                  </button>
                </div>
                </>
              )}
              {lastSpecialEvent && (
                <div className="rounded-md border border-violet-300/70 bg-white/90 px-3 py-2.5 text-sm text-violet-950 shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                    Último registado
                  </div>
                  <div className="mt-0.5 text-[10px] text-gray-500">
                    Mantido nesta aba ao sair da tela; some ao fechar a aba.
                  </div>
                  <div className="mt-1 font-medium text-gray-900">{lastSpecialEvent.label}</div>
                  <div className="mt-0.5 text-xs text-gray-600">
                    {formatSpecialEventInstant(lastSpecialEvent.atIso)}
                  </div>
                </div>
              )}
            </div>

            {(data.suggestedAction === 'NOVO_CICLO_SUGERIDO' ||
              data.suggestedAction === 'PRIMEIRO_CICLO') && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                <div className="font-semibold text-emerald-900">Novo ciclo sugerido</div>
                <ul className="text-sm text-emerald-900 list-disc pl-5 space-y-1">
                  {data.diff.patraoChanged && (
                    <li>
                      Patrôa mudou: {data.lastCycle?.patraoNome ?? '—'} →{' '}
                      {data.patraoDetected.nome ?? '—'}
                    </li>
                  )}
                  <li>{data.diff.functionChanges} mudança(ões) de função</li>
                  <li>{data.diff.groupChanges} mudança(ões) de grupo</li>
                </ul>
                <button
                  type="button"
                  disabled={!canConfirmCycle || !!busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        'Confirmar novo ciclo? Será criado um snapshot e eventos iniciais. O ciclo anterior será concluído.'
                      )
                    ) {
                      return;
                    }
                    void postJson(CONFIRM_CYCLE_API);
                  }}
                  className="rounded-md bg-emerald-700 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
                >
                  Confirmar novo ciclo
                </button>
              </div>
            )}

            {data.suggestedAction === 'ATENCAO' && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 space-y-3">
                <p>
                  Patrôa mudou, mas há poucas mudanças de função (&lt; 4). Não confirmamos ciclo
                  automaticamente. Revise a tabela e confira eventos sugeridos antes de aplicar.
                </p>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        'ATENÇÃO: O sistema não sugeriu ciclo novo. Só continue se tiver certeza editorial — criar novo ciclo mesmo assim?'
                      )
                    ) {
                      return;
                    }
                    void postJson(CONFIRM_CYCLE_API);
                  }}
                  className="rounded-md border border-amber-800 bg-white text-amber-950 px-4 py-2 text-sm font-medium hover:bg-amber-100 disabled:opacity-50"
                >
                  Forçar novo ciclo mesmo assim
                </button>
              </div>
            )}

            {(data.suggestedAction === 'EVENTO_DENTRO_CICLO' || data.suggestedAction === 'ATENCAO') &&
              data.suggestedEvents.length > 0 && (
                <div className="rounded-lg border border-indigo-200 bg-white p-4 space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="font-semibold text-gray-900">Eventos dentro do ciclo (sugeridos)</div>
                    <div className="text-xs text-gray-600">
                      Selecionados: {selectedEvents.size} / {data.suggestedEvents.length}
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Ao confirmar: promoção Trampo→Parça conta <code className="bg-gray-100 px-0.5 rounded">casaDoPatrao</code>,
                    <code className="bg-gray-100 px-0.5 rounded">parca</code> e{' '}
                    <code className="bg-gray-100 px-0.5 rounded">promovidoDoTrampoParaParca</code> (sem novo{' '}
                    <code className="bg-gray-100 px-0.5 rounded">casaDoTrampo</code> se já contou neste ciclo).{' '}
                    <strong>TRAMPO_FUNCTION_CHANGED</strong>: +1 só no contador da função de destino (ex. BANHEIRO); não
                    repete <code className="bg-gray-100 px-0.5 rounded">casaDoTrampo</code>. Eventos iguais no mesmo
                    ciclo são ignorados no servidor.
                  </p>
                  <ul className="divide-y divide-gray-100 border border-gray-100 rounded-md max-h-72 overflow-auto">
                    {data.suggestedEvents.map((ev) => (
                      <li
                        key={ev.id}
                        className="flex gap-3 items-start px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selectedEvents.has(ev.id)}
                          onChange={() => toggleEvent(ev.id)}
                        />
                        <div>
                          <div className="font-medium text-gray-900">
                            {ev.type} · {ev.participanteNome}
                          </div>
                          <div className="text-gray-600 text-xs">
                            {ev.fromGrupo ?? '—'} → {ev.toGrupo} | {ev.fromFuncao ?? '—'} →{' '}
                            {ev.toFuncao ?? '—'}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={!canConfirmEvents || !!busy || selectedEvents.size === 0}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Confirmar ${selectedEvents.size} evento(s) no ciclo atual? Os contadores serão recalculados.`
                        )
                      ) {
                        return;
                      }
                      const list = data.suggestedEvents.filter((e) => selectedEvents.has(e.id));
                      void postJson(CONFIRM_EVENTS_API, { events: list });
                    }}
                    className="rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
                  >
                    Confirmar eventos selecionados
                  </button>
                  {!data.history.currentCycleId && (
                    <p className="text-xs text-red-600">
                      Não há ciclo ativo: use &quot;Confirmar novo ciclo&quot; antes de eventos.
                    </p>
                  )}
                </div>
              )}

            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-900">
                Comparação (último snapshot registrado vs JSON atual)
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Participante</th>
                      <th className="px-3 py-2">Função anterior</th>
                      <th className="px-3 py-2">Grupo anterior</th>
                      <th className="px-3 py-2">Função atual</th>
                      <th className="px-3 py-2">Grupo atual</th>
                      <th className="px-3 py-2">Mudança</th>
                      <th className="px-3 py-2">Ação sugerida</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.diff.rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                          Sem diferenças em relação ao último snapshot.
                        </td>
                      </tr>
                    ) : (
                      data.diff.rows.map((r) => (
                        <tr key={r.participanteNome + r.tipoMudanca + (r.funcaoAnterior ?? '')}>
                          <td className="px-3 py-2 font-medium text-gray-900">{r.participanteNome}</td>
                          <td className="px-3 py-2 text-gray-700">{r.funcaoAnterior ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-700">{r.grupoAnterior ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-700">{r.funcaoAtual}</td>
                          <td className="px-3 py-2 text-gray-700">{r.grupoAtual}</td>
                          <td className="px-3 py-2 text-gray-700">{r.tipoMudanca}</td>
                          <td className="px-3 py-2 text-gray-600">{r.acaoSugerida}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="font-semibold text-gray-900">
                  Histórico agregado (recalculado dos ciclos/eventos)
                </div>
                <button
                  type="button"
                  onClick={() => setIsHistoricoAggregadoOpen(true)}
                  disabled={!data || data.history.participants.length === 0}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Ver (tela cheia)
                </button>
              </div>
              <div className="px-4 py-2 border-b border-gray-100 text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  <strong className="text-gray-900">{data.history.participants.length}</strong> participante(s)
                </span>
                <span className="text-gray-400">•</span>
                <span>Clique numa linha para detalhes</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-left text-[10px] uppercase text-gray-500 sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-2 sticky left-0 z-20 bg-gray-50 w-48 min-w-48 max-w-48">Nome</th>
                      <th className="px-2 py-2 sticky left-48 z-20 bg-gray-50 w-28 min-w-28 max-w-28">Status</th>
                      <th className="px-2 py-2 sticky left-[304px] z-20 bg-gray-50 w-32 min-w-32 max-w-32">Função</th>
                      {HISTORICO_COUNTER_COLS.map((c) => (
                        <th key={c.field} className="px-2 py-2 whitespace-nowrap" title={c.title ?? c.label}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.history.participants.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3 + HISTORICO_COUNTER_COLS.length}
                          className="px-3 py-6 text-center text-gray-500 text-sm"
                        >
                          Nenhum participante no histórico ainda.
                        </td>
                      </tr>
                    ) : (
                      data.history.participants.map((p, idx) => (
                        <tr
                          key={p.key}
                          onClick={() => setSelectedParticipantKey(p.key)}
                          aria-label={`Abrir detalhe do participante ${p.nome}`}
                          className={
                            idx % 2 === 0
                              ? 'group bg-white transition-colors hover:bg-indigo-50 cursor-pointer'
                              : 'group bg-gray-50/40 transition-colors hover:bg-indigo-50 cursor-pointer'
                          }
                          title="Clique para ver detalhes"
                        >
                          <td
                            className="px-2 py-2 font-medium text-gray-900 whitespace-nowrap sticky left-0 z-10 bg-inherit group-hover:bg-indigo-50 w-48 min-w-48 max-w-48"
                            title={p.nome}
                          >
                            <span className="block truncate">{p.nome}</span>
                          </td>
                          <td className="px-2 py-2 sticky left-48 z-10 bg-inherit group-hover:bg-indigo-50 w-28 min-w-28 max-w-28">
                            {(() => {
                              const isOut = p.statusAtual === 'FORA_DO_JOGO' || (p.historico?.foraDoJogo ?? 0) > 0;
                              return (
                            <span
                              className={
                                isOut
                                  ? 'inline-flex rounded bg-red-50 text-red-800 border border-red-200 px-2 py-0.5 text-[10px] font-semibold'
                                  : 'inline-flex rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold'
                              }
                            >
                              {isOut ? 'FORA_DO_JOGO' : p.statusAtual}
                            </span>
                              );
                            })()}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap sticky left-[304px] z-10 bg-inherit group-hover:bg-indigo-50 w-32 min-w-32 max-w-32">
                            <span className="inline-flex rounded bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 text-[10px] font-medium">
                              {p.funcaoAtual || '—'}
                            </span>
                          </td>
                          {HISTORICO_COUNTER_COLS.map(({ field: k }) => (
                            <td
                              key={k}
                              className={
                                k === 'taNaReta' || k === 'poderDoVoto' || k === 'foraDoJogo' || k === 'provaToFora'
                                  ? 'px-2 py-2 text-center tabular-nums font-semibold text-gray-900 group-hover:bg-indigo-50'
                                  : 'px-2 py-2 text-center tabular-nums text-gray-800 group-hover:bg-indigo-50'
                              }
                            >
                              <span
                                className={
                                  (p.historico[k] ?? 0) > 0
                                    ? 'inline-flex min-w-6 justify-center rounded bg-white border border-gray-200 px-1.5 py-0.5 group-hover:bg-white'
                                    : 'inline-flex min-w-6 justify-center rounded bg-gray-100 border border-gray-200 px-1.5 py-0.5 text-gray-500 group-hover:bg-white'
                                }
                              >
                                {p.historico[k] ?? 0}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {selectedParticipantKey && (
        <ParticipantDetailModal
          participant={selectedParticipant}
          onClose={() => setSelectedParticipantKey(null)}
        />
      )}

      {isHistoricoAggregadoOpen && data && (
        <HistoricoAggregadoModal
          participants={data.history.participants}
          onClose={() => setIsHistoricoAggregadoOpen(false)}
          onOpenParticipant={(key) => {
            setSelectedParticipantKey(key);
            setIsHistoricoAggregadoOpen(false);
          }}
        />
      )}
    </div>
  );
};

function toneClasses(tone: 'indigo' | 'slate' | 'amber' | 'violet' | 'rose' | 'red'): {
  border: string;
  bg: string;
  label: string;
  value: string;
} {
  switch (tone) {
    case 'indigo':
      return { border: 'border-indigo-200', bg: 'bg-indigo-50/60', label: 'text-indigo-700', value: 'text-indigo-950' };
    case 'amber':
      return { border: 'border-amber-200', bg: 'bg-amber-50/60', label: 'text-amber-700', value: 'text-amber-950' };
    case 'violet':
      return { border: 'border-violet-200', bg: 'bg-violet-50/60', label: 'text-violet-700', value: 'text-violet-950' };
    case 'rose':
      return { border: 'border-rose-200', bg: 'bg-rose-50/60', label: 'text-rose-700', value: 'text-rose-950' };
    case 'red':
      return { border: 'border-red-200', bg: 'bg-red-50/60', label: 'text-red-700', value: 'text-red-950' };
    case 'slate':
    default:
      return { border: 'border-slate-200', bg: 'bg-slate-50/60', label: 'text-slate-600', value: 'text-slate-950' };
  }
}

function CounterCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'indigo' | 'slate' | 'amber' | 'violet' | 'rose' | 'red';
}) {
  const t = toneClasses(tone);
  const active = value > 0;
  return (
    <div
      className={[
        'rounded-xl border p-3',
        active ? `${t.border} ${t.bg}` : 'border-gray-200 bg-white',
      ].join(' ')}
    >
      <div className={['text-xs', active ? t.label : 'text-gray-500'].join(' ')}>{label}</div>
      <div
        className={[
          'mt-1 text-2xl font-semibold tabular-nums',
          active ? t.value : 'text-gray-900',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  );
}

function CompactCounterCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'indigo' | 'slate' | 'amber' | 'violet' | 'rose' | 'red';
}) {
  const t = toneClasses(tone);
  const active = value > 0;
  return (
    <div
      className={[
        'rounded-xl border px-3 py-2',
        active ? `${t.border} ${t.bg}` : 'border-gray-200 bg-white',
      ].join(' ')}
    >
      <div className={['text-[11px]', active ? t.label : 'text-gray-500'].join(' ')}>{label}</div>
      <div
        className={[
          'mt-0.5 text-xl font-semibold tabular-nums',
          active ? t.value : 'text-gray-900',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: 'slate' | 'emerald' | 'red' | 'indigo';
  children: React.ReactNode;
}) {
  const cls =
    tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : tone === 'red'
        ? 'bg-red-50 text-red-800 border-red-200'
        : tone === 'indigo'
          ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
          : 'bg-slate-100 text-slate-800 border-slate-200';
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function ParticipantDetailModal({
  participant,
  onClose,
}: {
  participant: PreviewPayload['history']['participants'][number] | null;
  onClose: () => void;
}) {
  if (!participant) return null;
  const h = participant.historico;

  const isOut = participant.statusAtual === 'FORA_DO_JOGO' || (h.foraDoJogo ?? 0) > 0;
  const statusTone = isOut ? 'red' : 'emerald';
  const groupTone =
    participant.grupoAtual === 'FORA_DO_JOGO'
      ? 'red'
      : participant.grupoAtual === 'CASA_DO_PATRAO'
        ? 'indigo'
        : 'slate';

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-4xl rounded-2xl bg-white shadow-xl border border-gray-200 max-h-[92vh] overflow-y-auto"
        >
          <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-gray-500">Participante</div>
              <div className="mt-1 text-lg font-semibold text-gray-900 truncate" title={participant.nome}>
                {participant.nome}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <Badge tone={statusTone}>{isOut ? 'FORA_DO_JOGO' : participant.statusAtual}</Badge>
                <Badge tone={groupTone}>{participant.grupoAtual}</Badge>
                <Badge tone="slate">{participant.funcaoAtual || '—'}</Badge>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Fechar
            </button>
          </div>

          <div className="px-4 py-4 space-y-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50/40 p-3">
              <div className="text-sm font-semibold text-gray-900">Situação atual</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <CompactCounterCard label="Status atual" value={isOut ? 1 : 0} tone="red" />
                <CompactCounterCard
                  label="Grupo atual"
                  value={participant.grupoAtual === 'CASA_DO_PATRAO' ? 1 : participant.grupoAtual === 'CASA_DO_TRAMPO' ? 2 : 3}
                  tone="slate"
                />
                <CompactCounterCard label="Função atual" value={participant.funcaoAtual ? 1 : 0} tone="slate" />
              </div>
              <p className="mt-2 text-xs text-gray-600">
                Nota: esta seção é informativa (não é um contador do histórico).
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-900">Casas e papéis</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <CompactCounterCard label="Casa do Patrão" value={h.casaDoPatrao ?? 0} tone="indigo" />
                <CompactCounterCard label="Casa do Trampo" value={h.casaDoTrampo ?? 0} tone="amber" />
                <CompactCounterCard label="Patrão/Patroa" value={h.patrao ?? 0} tone="indigo" />
                <CompactCounterCard label="Parça" value={h.parca ?? 0} tone="indigo" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-900">Funções do Trampo</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <CompactCounterCard label="Cozinha" value={h.cozinha ?? 0} tone="amber" />
                <CompactCounterCard label="Louça" value={h.louca ?? 0} tone="amber" />
                <CompactCounterCard label="Banheiro" value={h.banheiro ?? 0} tone="amber" />
                <CompactCounterCard label="Lavanderia" value={h.lavanderia ?? 0} tone="amber" />
                <CompactCounterCard label="Servir" value={h.servir ?? 0} tone="amber" />
                <CompactCounterCard label="Faxina" value={h.faxina ?? 0} tone="amber" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-900">Eventos especiais</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <CompactCounterCard label="Poder do Voto" value={h.poderDoVoto ?? 0} tone="violet" />
                <CompactCounterCard label="Prova Tô Fora" value={h.provaToFora ?? 0} tone="violet" />
                <CompactCounterCard label="Tá na Reta" value={h.taNaReta ?? 0} tone="rose" />
                <CompactCounterCard
                  label="Promov. → Parça"
                  value={h.promovidoDoTrampoParaParca ?? 0}
                  tone="violet"
                />
                <CompactCounterCard
                  label="Promov. → Patrão"
                  value={h.promovidoDoTrampoParaPatrao ?? 0}
                  tone="violet"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-900">Jogo</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <CompactCounterCard label="Fora do Jogo" value={h.foraDoJogo ?? 0} tone="red" />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="text-sm font-semibold text-gray-900">Eventos registrados</div>
              <p className="mt-2 text-xs text-gray-600">
                Eventos detalhados não carregados neste preview; exibindo apenas contadores agregados.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoricoAggregadoModal({
  participants,
  onClose,
  onOpenParticipant,
}: {
  participants: PreviewPayload['history']['participants'];
  onClose: () => void;
  onOpenParticipant: (key: string) => void;
}) {
  const [query, setQuery] = React.useState('');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter((p) => p.nome.toLowerCase().includes(q) || p.key.toLowerCase().includes(q));
  }, [participants, query]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-0 flex flex-col p-3 sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          className="flex h-full w-full flex-col rounded-2xl bg-white shadow-xl border border-gray-200 overflow-hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-gray-500">Histórico agregado</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">
                Participantes e contadores
              </div>
              <div className="mt-1 text-xs text-gray-600">
                {filtered.length} de {participants.length} participante(s)
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar nome ou key…"
                className="w-56 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-left text-[10px] uppercase text-gray-500 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-2 sticky left-0 z-20 bg-gray-50 w-56 min-w-56 max-w-56">Nome</th>
                  <th className="px-2 py-2 sticky left-56 z-20 bg-gray-50 w-28 min-w-28 max-w-28">Status</th>
                  <th className="px-2 py-2 whitespace-nowrap sticky left-[336px] z-20 bg-gray-50 w-40 min-w-40 max-w-40">
                    Função
                  </th>
                  {HISTORICO_COUNTER_COLS.map((c) => (
                    <th key={c.field} className="px-2 py-2 whitespace-nowrap" title={c.title ?? c.label}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={3 + HISTORICO_COUNTER_COLS.length} className="px-3 py-10 text-center text-gray-500">
                      Nenhum resultado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p, idx) => (
                    <tr
                      key={p.key}
                      onClick={() => onOpenParticipant(p.key)}
                      className={
                        idx % 2 === 0
                          ? 'group bg-white transition-colors hover:bg-indigo-50 cursor-pointer'
                          : 'group bg-gray-50/40 transition-colors hover:bg-indigo-50 cursor-pointer'
                      }
                      title="Clique para ver detalhes"
                    >
                      <td
                        className="px-2 py-2 font-medium text-gray-900 whitespace-nowrap sticky left-0 z-10 bg-inherit group-hover:bg-indigo-50 w-56 min-w-56 max-w-56"
                        title={p.nome}
                      >
                        <span className="block truncate">{p.nome}</span>
                      </td>
                      <td className="px-2 py-2 sticky left-56 z-10 bg-inherit group-hover:bg-indigo-50 w-28 min-w-28 max-w-28">
                        {(() => {
                          const isOut = p.statusAtual === 'FORA_DO_JOGO' || (p.historico?.foraDoJogo ?? 0) > 0;
                          return (
                            <span
                              className={
                                isOut
                                  ? 'inline-flex rounded bg-red-50 text-red-800 border border-red-200 px-2 py-0.5 text-[10px] font-semibold'
                                  : 'inline-flex rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold'
                              }
                            >
                              {isOut ? 'FORA_DO_JOGO' : p.statusAtual}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap sticky left-[336px] z-10 bg-inherit group-hover:bg-indigo-50 w-40 min-w-40 max-w-40">
                        <span className="inline-flex rounded bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 text-[10px] font-medium">
                          {p.funcaoAtual || '—'}
                        </span>
                      </td>
                      {HISTORICO_COUNTER_COLS.map(({ field: k }) => (
                        <td
                          key={k}
                          className={
                            k === 'taNaReta' || k === 'poderDoVoto' || k === 'foraDoJogo' || k === 'provaToFora'
                              ? 'px-2 py-2 text-center tabular-nums font-semibold text-gray-900 group-hover:bg-indigo-50'
                              : 'px-2 py-2 text-center tabular-nums text-gray-800 group-hover:bg-indigo-50'
                          }
                        >
                          <span
                            className={
                              (p.historico[k] ?? 0) > 0
                                ? 'inline-flex min-w-6 justify-center rounded bg-white border border-gray-200 px-1.5 py-0.5 group-hover:bg-white'
                                : 'inline-flex min-w-6 justify-center rounded bg-gray-100 border border-gray-200 px-1.5 py-0.5 text-gray-500 group-hover:bg-white'
                            }
                          >
                            {p.historico[k] ?? 0}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-600">
            Dica: use a busca e clique numa linha para abrir o detalhe do participante.
          </div>
        </div>
      </div>
    </div>
  );
}
