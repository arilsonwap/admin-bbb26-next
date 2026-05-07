'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type VideoItem = {
  title: string;
  href: string;
  imageUrl?: string;
  type: 'video';
  category?: string;
  time?: string;
};

type ApiResponse =
  | {
      ok: true;
      source: string;
      count: number;
      items: VideoItem[];
      fetchedAt: string | null;
      savedTo?: string;
      lastAddedCount?: number;
    }
  | {
      ok: false;
      error: string;
    };

export function CasaDoPatraoVideosScreen() {
  const [loadingPhase, setLoadingPhase] = useState<'idle' | 'loadSaved' | 'fetchRemote'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<VideoItem[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [lastAddedCount, setLastAddedCount] = useState<number>(0);

  const loadSaved = useCallback(async () => {
    setLoadingPhase('loadSaved');
    setError(null);
    try {
      const res = await fetch('/api/casa-do-patrao-videos?read=1', {
        method: 'GET',
        cache: 'no-store',
      });
      const data = (await res.json()) as ApiResponse;
      if (!data.ok) {
        setError(data.error || 'Falha ao carregar vídeos salvos');
        return;
      }
      setItems(data.items);
      setFetchedAt(data.fetchedAt);
      setLastAddedCount(data.lastAddedCount ?? 0);
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
      const res = await fetch('/api/casa-do-patrao-videos', {
        method: 'GET',
        cache: 'no-store',
      });
      const data = (await res.json()) as ApiResponse;
      if (!data.ok) {
        setError(data.error || 'Falha ao buscar vídeos');
        return;
      }
      setItems(data.items);
      setFetchedAt(data.fetchedAt);
      setLastAddedCount(data.lastAddedCount ?? 0);
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
    if (loadingPhase === 'loadSaved') return 'Carregando vídeos salvos...';
    if (loadingPhase === 'fetchRemote') return 'Buscando vídeos na Record/R7...';
    if (error) return error;
    if (fetchedAt) return `Atualizado em ${new Date(fetchedAt).toLocaleString('pt-BR')}`;
    return 'Clique no botão para buscar os vídeos.';
  }, [loadingPhase, error, fetchedAt]);

  const metaLabel = (it: VideoItem) => {
    const parts = [it.category, it.time].filter(Boolean);
    return parts.length ? parts.join(' / ') : null;
  };

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">
              🎬 Vídeos Casa do Patrão
            </h1>

            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div
                className={`inline-flex items-center rounded-full border px-3 py-1 text-sm ${
                  error
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                {subtitle}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">
                    Total no JSON
                  </div>
                  <div className="mt-0.5 text-lg font-semibold text-gray-900">
                    {items.length}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">
                    Novos na última busca
                  </div>
                  <div className="mt-0.5 text-lg font-semibold text-gray-900">
                    {lastAddedCount}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFetch}
            disabled={loadingPhase !== 'idle'}
            className="inline-flex items-center rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingPhase === 'fetchRemote' ? 'Buscando...' : 'Buscar vídeos'}
          </button>
        </div>

        <div className="mt-6">
          {items.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
              Nenhum vídeo carregado.
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((it) => (
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
                        {metaLabel(it) ? (
                          <div className="mt-1">
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
                              {metaLabel(it)}
                            </span>
                          </div>
                        ) : null}
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

