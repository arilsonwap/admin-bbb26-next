'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type ContentType = 'noticia' | 'video' | 'foto';

type ContentItem = {
  title: string;
  href: string;
  imageUrl?: string;
  type: ContentType;
  category?: string;
  time?: string;
};

type Counts = Record<ContentType, number>;

type ApiPayload = {
  source: string;
  fetchedAt: string | null;
  lastAddedCount: number;
  counts: Counts;
  items: ContentItem[];
};

const EMPTY: ApiPayload = {
  source: 'casa-do-patrao-conteudos',
  fetchedAt: null,
  lastAddedCount: 0,
  counts: { noticia: 0, video: 0, foto: 0 },
  items: [],
};

type Tab = 'all' | ContentType;

function tabLabel(tab: Tab) {
  if (tab === 'all') return 'Todos';
  if (tab === 'noticia') return 'Notícias';
  if (tab === 'video') return 'Vídeos';
  return 'Fotos';
}

export function CasaDoPatraoConteudosScreen() {
  const [loadingPhase, setLoadingPhase] = useState<'idle' | 'loadSaved' | 'fetchRemote'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ApiPayload>(EMPTY);
  const [tab, setTab] = useState<Tab>('all');

  const loadSaved = useCallback(async () => {
    setLoadingPhase('loadSaved');
    setError(null);
    try {
      const res = await fetch('/api/casa-do-patrao-conteudos?read=1', {
        method: 'GET',
        cache: 'no-store',
      });
      const data = (await res.json()) as ApiPayload;
      setPayload({
        source: data?.source || EMPTY.source,
        fetchedAt: data?.fetchedAt ?? null,
        lastAddedCount: typeof data?.lastAddedCount === 'number' ? data.lastAddedCount : 0,
        counts: data?.counts || EMPTY.counts,
        items: Array.isArray(data?.items) ? data.items : [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setLoadingPhase('idle');
    }
  }, []);

  const handleFetch = useCallback(async () => {
    setLoadingPhase('fetchRemote');
    setError(null);
    try {
      const res = await fetch('/api/casa-do-patrao-conteudos', {
        method: 'GET',
        cache: 'no-store',
      });
      const data = (await res.json()) as ApiPayload;
      if (!res.ok) {
        const msg = (data as unknown as { error?: string })?.error || 'Falha ao buscar conteúdos';
        setError(msg);
        return;
      }
      setPayload({
        source: data?.source || EMPTY.source,
        fetchedAt: data?.fetchedAt ?? null,
        lastAddedCount: typeof data?.lastAddedCount === 'number' ? data.lastAddedCount : 0,
        counts: data?.counts || EMPTY.counts,
        items: Array.isArray(data?.items) ? data.items : [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setLoadingPhase('idle');
    }
  }, []);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const subtitle = useMemo(() => {
    if (loadingPhase === 'loadSaved') return 'Carregando JSON salvo...';
    if (loadingPhase === 'fetchRemote') return 'Buscando conteúdos na Record/R7...';
    if (error) return error;
    if (payload.fetchedAt) return `Atualizado em ${new Date(payload.fetchedAt).toLocaleString('pt-BR')}`;
    return 'Clique no botão para buscar os conteúdos.';
  }, [loadingPhase, error, payload.fetchedAt]);

  const filtered = useMemo(() => {
    if (tab === 'all') return payload.items;
    return payload.items.filter((it) => it.type === tab);
  }, [payload.items, tab]);

  const typeBadge = (t: ContentType) => {
    if (t === 'noticia') return 'NOTÍCIA';
    if (t === 'video') return 'VÍDEO';
    return 'FOTO';
  };

  const metaLabel = (it: ContentItem) => {
    const parts = [it.category, it.time].filter(Boolean);
    return parts.length ? parts.join(' / ') : null;
  };

  const TabButton = (props: { value: Tab }) => {
    const active = tab === props.value;
    return (
      <button
        type="button"
        onClick={() => setTab(props.value)}
        className={`rounded-full px-3 py-1 text-sm border ${
          active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
        }`}
      >
        {tabLabel(props.value)}
      </button>
    );
  };

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">
              📺 Conteúdos Casa do Patrão
            </h1>

            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div
                className={`inline-flex items-center rounded-full border px-3 py-1 text-sm ${
                  error ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                {subtitle}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Total</div>
                  <div className="mt-0.5 text-lg font-semibold text-gray-900">{payload.items.length}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Notícias</div>
                  <div className="mt-0.5 text-lg font-semibold text-gray-900">{payload.counts.noticia}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Vídeos</div>
                  <div className="mt-0.5 text-lg font-semibold text-gray-900">{payload.counts.video}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Fotos</div>
                  <div className="mt-0.5 text-lg font-semibold text-gray-900">{payload.counts.foto}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Novos</div>
                  <div className="mt-0.5 text-lg font-semibold text-gray-900">{payload.lastAddedCount}</div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <TabButton value="all" />
              <TabButton value="noticia" />
              <TabButton value="video" />
              <TabButton value="foto" />
            </div>
          </div>

          <button
            type="button"
            onClick={handleFetch}
            disabled={loadingPhase !== 'idle'}
            className="inline-flex items-center rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingPhase === 'fetchRemote' ? 'Buscando...' : 'Buscar conteúdos'}
          </button>
        </div>

        <div className="mt-6">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
              {payload.items.length === 0 ? 'Nenhum conteúdo carregado.' : 'Nenhum item neste filtro.'}
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((it) => (
                <li key={it.href} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {it.imageUrl ? (
                        <img
                          src={it.imageUrl}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-md bg-gray-100 object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="h-12 w-12 shrink-0 rounded-md bg-gray-100" />
                      )}

                      <div className="min-w-0">
                        <a
                          href={it.href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-gray-900 hover:underline"
                        >
                          <span className="block truncate">{it.title}</span>
                        </a>

                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
                            {typeBadge(it.type)}
                          </span>
                          {metaLabel(it) ? (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
                              {metaLabel(it)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-gray-500 break-all">{it.href}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

