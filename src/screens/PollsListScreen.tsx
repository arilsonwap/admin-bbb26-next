'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, MenuButton, MenuItem, MenuItems, MenuSeparator } from '@headlessui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  HomeIcon,
  PlusIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';
import type { PollLifecycleStatus, PollRow, PollType } from '../models/pollsTypes';
import { PollStatusBadge } from '../components/polls/PollStatusBadge';
import {
  listPolls,
  publishPoll,
  closePoll,
  pausePoll,
  duplicatePoll,
  setPollAutoOpenPriority,
  PollsApiError,
} from '../services/pollsAdminClient';
import { useNotifications } from '../hooks/useNotifications';
import { Card } from '../components/common/Card';
import { ToastContainer } from '../components/ui/Toast';
import { pollsQueryKeys } from '../lib/pollsQueryKeys';
import { homeHubActivePolls, resolveAutoOpenWinner } from '../lib/pollsAutoOpen';

function formatTypeLabel(type: PollType): string {
  return type === 'home' ? 'Home' : 'Paredão';
}

function formatDateBR(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

function isLikelyNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof Error && /failed to fetch|networkerror|load failed/i.test(err.message)) {
    return true;
  }
  return false;
}

function mutationErrorFeedback(err: unknown): { title: string; detail: string; refetchList: boolean } {
  if (isLikelyNetworkError(err)) {
    return {
      title: 'Falha de rede',
      detail: 'Verifique a conexão e tente novamente.',
      refetchList: false,
    };
  }
  if (err instanceof PollsApiError) {
    if (err.code === 'MULTIPLE_ACTIVE_POLLS') {
      return { title: 'Conflito ao ativar', detail: err.message, refetchList: true };
    }
    if (err.code === 'POLL_CLOSED' || err.code === 'POLL_ALREADY_CLOSED') {
      return { title: 'Ação indisponível', detail: err.message, refetchList: true };
    }
    if (err.code === 'ALREADY_ACTIVE') {
      return { title: 'Já ativa', detail: err.message, refetchList: true };
    }
    if (err.code === 'INVALID_STATE') {
      return { title: 'Estado inválido', detail: err.message, refetchList: true };
    }
    if (err.code === 'CLOSE_NO_ROWS') {
      return { title: 'Encerramento não aplicado', detail: err.message, refetchList: true };
    }
    if (err.code === 'UNAUTHORIZED') {
      return { title: 'Acesso negado', detail: err.message, refetchList: false };
    }
    if (err.status === 409) {
      return { title: 'Conflito', detail: err.message, refetchList: true };
    }
    return { title: 'Erro', detail: err.message, refetchList: err.status ? err.status >= 500 : false };
  }
  const message = err instanceof Error ? err.message : 'Erro desconhecido';
  return { title: 'Erro', detail: message, refetchList: false };
}

type StatusFilter = 'all' | PollLifecycleStatus;
type TypeFilter = 'all' | PollType;
type ScheduleFilter = 'all' | 'scheduled' | 'active_window' | 'ended';
type AutoFilter = 'all' | 'yes' | 'no';

function matchesSchedule(p: PollRow, f: ScheduleFilter): boolean {
  if (f === 'all') return true;
  const now = Date.now();
  const openMs = p.open_at ? new Date(p.open_at).getTime() : NaN;
  const closeMs = p.close_at ? new Date(p.close_at).getTime() : NaN;
  if (f === 'scheduled') {
    return p.status === 'scheduled' || Boolean(p.open_at && !Number.isNaN(openMs) && openMs > now);
  }
  if (f === 'active_window') {
    if (p.status === 'active') {
      if (p.open_at && Number.isNaN(openMs)) console.warn('[Poll][InconsistentOpenAtInvalid]', p.id);
      if (p.close_at && Number.isNaN(closeMs)) console.warn('[Poll][InconsistentCloseAtInvalid]', p.id);
      if (p.open_at && !Number.isNaN(openMs) && openMs > now) {
        console.warn('[Poll][InconsistentActiveFuture]', p.id);
      }
      if (p.close_at && !Number.isNaN(closeMs) && closeMs <= now) {
        console.warn('[Poll][InconsistentActiveEnded]', p.id);
      }
    }
    return (
      p.status === 'active' &&
      (!p.open_at || (!Number.isNaN(openMs) && openMs <= now)) &&
      (!p.close_at || (!Number.isNaN(closeMs) && closeMs > now))
    );
  }
  if (f === 'ended') {
    return (
      p.status === 'closed' ||
      Boolean(p.close_at && !Number.isNaN(closeMs) && closeMs <= now)
    );
  }
  return true;
}

export function PollsListScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showError, showSuccess, toasts, removeToast } = useNotifications();

  const [loadingPollIds, setLoadingPollIds] = useState<Set<string>>(() => new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>('all');
  const [autoFilter, setAutoFilter] = useState<AutoFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const id = window.setTimeout(() => setSearch(searchInput), 150);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const addLoadingPollId = useCallback((id: string) => {
    setLoadingPollIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const removeLoadingPollId = useCallback((id: string) => {
    setLoadingPollIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const {
    data: polls = [],
    isLoading: isListLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: pollsQueryKeys.list(),
    queryFn: listPolls,
    staleTime: 15_000,
  });

  const invalidateList = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: pollsQueryKeys.list(), refetchType: 'active' });
  }, [queryClient]);

  const onMutationError = useCallback(
    async (err: unknown) => {
      const fb = mutationErrorFeedback(err);
      showError(fb.title, fb.detail);
      if (fb.refetchList) await invalidateList();
    },
    [invalidateList, showError]
  );

  const setPollsData = useCallback(
    (next: PollRow[]) => {
      queryClient.setQueryData(pollsQueryKeys.list(), next);
    },
    [queryClient]
  );

  const validateActiveUniqueness = useCallback(
    (next: PollRow[]) => {
      const activeByType = next
        .filter((p) => p.status === 'active')
        .reduce(
          (acc, p) => {
            const key = String(p.type);
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

      Object.entries(activeByType).forEach(([type, count]) => {
        if (count > 1) {
          showError('Inconsistência detectada', `Mais de uma enquete ativa para ${type}. Recarregue a lista.`);
        }
      });
    },
    [showError]
  );

  const publishMutation = useMutation({
    mutationFn: publishPoll,
    onMutate: async (pollId) => {
      addLoadingPollId(pollId);
      await queryClient.cancelQueries({ queryKey: pollsQueryKeys.list() });
    },
    onError: onMutationError,
    onSuccess: (serverPolls) => {
      showSuccess('Enquete ativada', 'Outras do mesmo destino foram encerradas automaticamente.');
      void invalidateList().then(() => {
        const fresh = queryClient.getQueryData(pollsQueryKeys.list());
        if (Array.isArray(fresh)) validateActiveUniqueness(fresh as PollRow[]);
      });
    },
    onSettled: (_d, _e, pollId) => removeLoadingPollId(pollId),
  });

  const closeMutation = useMutation({
    mutationFn: closePoll,
    onMutate: async (pollId) => addLoadingPollId(pollId),
    onError: onMutationError,
    onSuccess: (serverPolls) => {
      showSuccess('Encerrada', 'Status atualizado.');
      void invalidateList();
    },
    onSettled: (_d, _e, pollId) => removeLoadingPollId(pollId),
  });

  const pauseMutation = useMutation({
    mutationFn: pausePoll,
    onMutate: async (pollId) => addLoadingPollId(pollId),
    onError: onMutationError,
    onSuccess: (serverPolls) => {
      showSuccess('Pausada', 'Enquete pausada.');
      void invalidateList();
    },
    onSettled: (_d, _e, pollId) => removeLoadingPollId(pollId),
  });

  const duplicateMutation = useMutation({
    mutationFn: duplicatePoll,
    onMutate: async (pollId) => addLoadingPollId(pollId),
    onError: onMutationError,
    onSuccess: (data) => {
      setPollsData(data.polls);
      showSuccess('Duplicada', 'Nova enquete em rascunho.');
      router.push(`/polls/${data.poll.id}`);
    },
    onSettled: (_d, _e, pollId) => removeLoadingPollId(pollId),
  });

  const priorityMutation = useMutation({
    mutationFn: ({ pollId, priority }: { pollId: string; priority: number }) =>
      setPollAutoOpenPriority(pollId, priority),
    onMutate: async ({ pollId }) => addLoadingPollId(pollId),
    onError: onMutationError,
    onSuccess: (serverPolls) => {
      showSuccess('Prioridade', 'Atualizada.');
      void invalidateList();
    },
    onSettled: (_d, _e, vars) => {
      if (vars?.pollId) removeLoadingPollId(vars.pollId);
    },
  });

  const filteredPolls = useMemo(() => {
    const q = search.trim().toLowerCase();
    return polls.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (typeFilter !== 'all' && p.type !== typeFilter) return false;
      if (!matchesSchedule(p, scheduleFilter)) return false;
      if (autoFilter === 'yes' && !p.auto_open_on_app_launch) return false;
      if (autoFilter === 'no' && p.auto_open_on_app_launch) return false;
      if (q) {
        const hay = `${p.title ?? ''} ${p.subtitle ?? ''} ${p.description ?? ''} ${p.id ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [polls, statusFilter, typeFilter, scheduleFilter, autoFilter, search]);

  const autoWinner = useMemo(() => resolveAutoOpenWinner(polls), [polls]);
  const hubHome = useMemo(() => homeHubActivePolls(polls), [polls]);
  const stats = useMemo(() => {
    const total = polls.length;
    let active = 0;
    let scheduled = 0;
    let draft = 0;
    let paused = 0;
    let closed = 0;
    for (const p of polls) {
      if (p.status === 'active') active += 1;
      else if (p.status === 'scheduled') scheduled += 1;
      else if (p.status === 'draft') draft += 1;
      else if (p.status === 'paused') paused += 1;
      else if (p.status === 'closed') closed += 1;
    }
    return { total, active, scheduled, draft, paused, closed };
  }, [polls]);

  const busy = (id: string) => loadingPollIds.has(id);

  const handlePublish = (pollId: string) => {
    if (busy(pollId)) return;
    if (!confirm('Ativar agora? No mesmo destino (home/paredão), outras ativas serão encerradas.')) return;
    publishMutation.mutate(pollId);
  };

  const handleClose = (pollId: string) => {
    if (busy(pollId)) return;
    if (!confirm('Encerrar esta enquete? Não poderá mais editar.')) return;
    closeMutation.mutate(pollId);
  };

  const handlePause = (pollId: string) => {
    if (busy(pollId)) return;
    if (!confirm('Pausar esta enquete?')) return;
    pauseMutation.mutate(pollId);
  };

  const handleDuplicate = (pollId: string) => {
    if (busy(pollId)) return;
    duplicateMutation.mutate(pollId);
  };

  const bumpPriority = (p: PollRow, delta: number) => {
    priorityMutation.mutate({
      pollId: p.id,
      priority: Math.max(0, p.auto_open_priority + delta),
    });
  };

  const clearFilters = () => {
    setSearchInput('');
    setStatusFilter('all');
    setTypeFilter('all');
    setScheduleFilter('all');
    setAutoFilter('all');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="hidden lg:block sticky top-0 z-10 border-b border-gray-200/90 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">Painel</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-950">Enquetes</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
                Controle de ciclo de vida, publicação e exibição no app — uma visão consolidada de tudo que está no ar.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-800">
                  <span className="font-semibold tabular-nums">{stats.total}</span>
                  <span className="text-gray-500">total</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-900">
                  <span className="font-semibold tabular-nums">{stats.active}</span>
                  <span className="text-green-800/90">ativas</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-950">
                  <span className="font-semibold tabular-nums">{stats.scheduled}</span>
                  <span className="text-indigo-800/90">agendadas</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-800">
                  <span className="font-semibold tabular-nums">{stats.draft}</span>
                  <span className="text-gray-500">rascunhos</span>
                </span>
                {stats.paused > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-950">
                    <span className="font-semibold tabular-nums">{stats.paused}</span>
                    <span className="text-amber-900/90">pausadas</span>
                  </span>
                ) : null}
                {isFetching && !isListLoading ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50/80 px-2.5 py-1 text-[11px] font-medium text-indigo-800">
                    <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Sincronizando
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-end">
              <button
                type="button"
                onClick={() => router.push('/polls/new')}
                className="inline-flex items-center justify-center px-5 py-2.5 border border-transparent rounded-xl text-sm font-semibold text-white bg-indigo-600 shadow-md transition-all duration-150 hover:bg-indigo-700 hover:shadow-lg active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                <PlusIcon className="h-4 w-4 mr-2 shrink-0" />
                Nova enquete
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('active');
                  setTypeFilter('all');
                  setScheduleFilter('all');
                  setAutoFilter('all');
                  setSearchInput('');
                }}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-800 shadow-sm transition-all duration-150 hover:border-indigo-200 hover:bg-indigo-50/80 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                Ver só ativas
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 lg:hidden rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">Painel</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-950">Enquetes</h1>
          <p className="mt-1 text-sm text-gray-600">Resumo e lista abaixo.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium text-gray-800">
              {stats.total} total
            </span>
            <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-[11px] font-medium text-green-900">
              {stats.active} ativas
            </span>
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-950">
              {stats.scheduled} agend.
            </span>
          </div>
          <button
            type="button"
            onClick={() => router.push('/polls/new')}
            className="mt-4 flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all active:scale-[0.98]"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Nova enquete
          </button>
        </div>
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8">
              <Card className="rounded-2xl border-gray-200/90 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900">Dashboard</div>
                    <div className="text-xs text-gray-500 mt-0.5">Resumo rápido do estado das enquetes.</div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    <div className="px-3 py-2 rounded-lg border border-gray-200 bg-white">
                      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Exibindo</div>
                      <div className="text-sm font-semibold text-gray-900">{filteredPolls.length}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-gray-200 bg-white p-4 transition-all duration-150 hover:border-gray-300 hover:shadow-sm">
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total</div>
                    <div className="mt-1 text-2xl font-semibold text-gray-900">{stats.total}</div>
                  </div>
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4 transition-all duration-150 hover:border-green-300 hover:shadow-sm hover:shadow-green-500/10">
                    <div className="text-[11px] font-semibold text-green-800 uppercase tracking-wide">Ativas</div>
                    <div className="mt-1 text-2xl font-semibold text-green-900">{stats.active}</div>
                  </div>
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 transition-all duration-150 hover:border-indigo-300 hover:shadow-sm hover:shadow-indigo-500/10">
                    <div className="text-[11px] font-semibold text-indigo-800 uppercase tracking-wide">Agendadas</div>
                    <div className="mt-1 text-2xl font-semibold text-indigo-900">{stats.scheduled}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-4 transition-all duration-150 hover:border-gray-300 hover:shadow-sm">
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Encerradas</div>
                    <div className="mt-1 text-2xl font-semibold text-gray-900">{stats.closed}</div>
                  </div>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-4">
              <div className="space-y-3">
                <div className="rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/70 via-white to-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                        <SignalIcon className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-indigo-900">
                          Auto-abrir no app
                        </div>
                        <div className="text-xs text-indigo-700/80">Vencedor por prioridade</div>
                      </div>
                    </div>
                    {autoWinner ? (
                      <button
                        type="button"
                        onClick={() => router.push(`/polls/${encodeURIComponent(autoWinner.id)}`)}
                        className="shrink-0 inline-flex items-center rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-800 shadow-sm transition-all duration-150 hover:border-indigo-300 hover:bg-indigo-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                      >
                        Ajustar
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 rounded-xl border border-indigo-100/80 bg-white/80 p-3">
                    {autoWinner ? (
                      <>
                        <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                          {autoWinner.title}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
                          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-800">
                            Prioridade {autoWinner.auto_open_priority}
                          </span>
                          <span className="text-gray-400">·</span>
                          <span>{formatTypeLabel(autoWinner.type)}</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-gray-600">
                        Nenhuma enquete com auto-abrir elegível no momento.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white shadow-sm">
                      <HomeIcon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-gray-900">
                        Hub Home
                      </div>
                      <div className="text-xs text-gray-500">Enquetes home ativas no hub</div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {hubHome.length === 0 ? (
                      <p className="text-sm text-gray-600">Nenhuma no hub.</p>
                    ) : (
                      hubHome.map((hp) => (
                        <button
                          key={hp.id}
                          type="button"
                          onClick={() => router.push(`/polls/${encodeURIComponent(hp.id)}`)}
                          className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2 text-left text-sm font-medium text-gray-900 transition-all duration-150 hover:-translate-y-px hover:border-indigo-200 hover:bg-indigo-50/70 hover:shadow-sm active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                        >
                          <span className="truncate">{hp.title}</span>
                          <span className="shrink-0 text-[10px] font-mono text-gray-400">{hp.id.slice(0, 6)}…</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Card className="rounded-2xl border-gray-200/90 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-gray-950">Lista</h2>
                <p className="text-sm text-gray-500 mt-1">Filtros e busca.</p>
              </div>
              <button
                type="button"
                onClick={() => router.push('/polls/new')}
                className="inline-flex lg:hidden items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 shadow-sm transition-all duration-150 hover:bg-indigo-700 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Nova enquete
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:flex-1">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700">
                    Buscar
                    <input
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Título, descrição ou ID…"
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 h-9 text-sm transition-shadow focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:flex lg:items-center">
                  <label className="block text-xs font-medium text-gray-700">
                    Status
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 h-9 text-sm transition-shadow focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    >
                      <option value="all">Todos</option>
                      <option value="draft">Rascunho</option>
                      <option value="scheduled">Agendada</option>
                      <option value="active">Ativa</option>
                      <option value="paused">Pausada</option>
                      <option value="closed">Encerrada</option>
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-gray-700">
                    Destino
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 h-9 text-sm transition-shadow focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    >
                      <option value="all">Todos</option>
                      <option value="home">Home</option>
                      <option value="paredao">Paredão</option>
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-gray-700">
                    Janela
                    <select
                      value={scheduleFilter}
                      onChange={(e) => setScheduleFilter(e.target.value as ScheduleFilter)}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 h-9 text-sm transition-shadow focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    >
                      <option value="all">Todas</option>
                      <option value="scheduled">Agendada / futura</option>
                      <option value="active_window">Ativa na janela</option>
                      <option value="ended">Encerrada / passou</option>
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-gray-700">
                    Auto-abrir
                    <select
                      value={autoFilter}
                      onChange={(e) => setAutoFilter(e.target.value as AutoFilter)}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 h-9 text-sm transition-shadow focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    >
                      <option value="all">Todos</option>
                      <option value="yes">Ligado</option>
                      <option value="no">Desligado</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-gray-600 whitespace-nowrap">
                  <span className="font-semibold text-gray-900">{filteredPolls.length}</span> resultados
                </div>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center px-3 h-9 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-800 shadow-sm transition-all duration-150 hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
          </Card>

          {isListLoading ? (
            <div className="text-sm text-gray-600 bg-white border border-gray-200/90 rounded-2xl p-6 shadow-sm">
              Carregando...
            </div>
          ) : isError ? (
            <div className="text-sm bg-red-50 border border-red-200 rounded-2xl p-6 space-y-3 shadow-sm">
              <p className="text-red-800">{error instanceof Error ? error.message : 'Erro ao carregar.'}</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-white bg-red-700 hover:bg-red-800"
              >
                Tentar novamente
              </button>
            </div>
          ) : filteredPolls.length === 0 ? (
            <div className="text-sm text-gray-600 bg-white border border-gray-200/90 rounded-2xl p-6 shadow-sm">
              Nenhuma enquete neste filtro.
            </div>
          ) : (
            <div className="space-y-4">
              {isFetching && !isListLoading ? (
                <div className="text-xs text-gray-500 px-1">Atualizando…</div>
              ) : null}
              {filteredPolls.map((p) => {
                const showHubHome =
                  p.type === 'home' && p.show_in_home_hub !== false && p.status === 'active';
                return (
                <div
                  key={p.id}
                  className={[
                    'relative flex rounded-2xl overflow-hidden border-2 transition-all duration-200 ease-out will-change-transform',
                    p.status === 'active'
                      ? 'border-green-500/90 bg-gradient-to-br from-green-50/95 via-white to-white shadow-md shadow-green-900/5 hover:-translate-y-0.5 hover:border-green-500 hover:shadow-lg hover:shadow-green-500/15'
                      : p.status === 'scheduled'
                      ? 'border-indigo-200/90 bg-white hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/10'
                      : p.status === 'paused'
                      ? 'border-amber-300 bg-amber-50/40 hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-200/40'
                      : p.status === 'closed'
                      ? 'border-gray-300 bg-gray-50/50 hover:-translate-y-0.5 hover:border-gray-400 hover:shadow-md'
                      : 'border-gray-200 bg-white hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-lg',
                  ].join(' ')}
                >
                  {p.status === 'active' ? (
                    <div className="w-1.5 shrink-0 bg-green-500" aria-hidden />
                  ) : null}
                  <div className="min-w-0 flex-1 p-5 sm:p-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <PollStatusBadge status={p.status} />
                      <span className="text-gray-300">·</span>
                      <span className="text-xs font-medium text-gray-500">{formatTypeLabel(p.type)}</span>
                    </div>

                    <h3 className="text-lg sm:text-xl font-bold tracking-tight text-gray-950 break-words leading-tight">
                      {p.title}
                    </h3>

                    {(p.subtitle || p.description) ? (
                      <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
                        {p.subtitle || p.description}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">Sem descrição.</p>
                    )}

                    <div className="mt-5 space-y-5 text-[11px] leading-relaxed">
                      <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          Janela
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6">
                          <div>
                            <p className="text-[10px] text-gray-400">Abertura</p>
                            <p className="mt-0.5 text-sm font-medium text-gray-800 tabular-nums">
                              {formatDateBR(p.open_at)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400">Encerramento</p>
                            <p className="mt-0.5 text-sm font-medium text-gray-800 tabular-nums">
                              {formatDateBR(p.close_at)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {p.auto_open_on_app_launch || showHubHome ? (
                        <div>
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            Configuração
                          </p>
                          <div className="space-y-2">
                            {p.auto_open_on_app_launch ? (
                              <p className="text-gray-600">
                                Auto-abrir no app · prioridade{' '}
                                <span className="font-semibold text-gray-800">{p.auto_open_priority}</span>
                              </p>
                            ) : null}
                            {showHubHome ? (
                              <p className="inline-flex items-center gap-1.5 text-gray-600">
                                <HomeIcon className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
                                <span>Exibida no hub Home</span>
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          Identificador
                        </p>
                        <p className="break-all font-mono text-[10px] text-gray-400 select-all">{p.id}</p>
                      </div>
                    </div>
                  </div>

                  {/* Área lateral: ações */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2 lg:items-end lg:justify-start lg:min-w-[220px]">
                    <button
                      type="button"
                      onClick={() => handlePublish(p.id)}
                      disabled={busy(p.id) || p.status === 'active' || p.status === 'closed'}
                      className="w-full sm:w-auto lg:w-full inline-flex items-center justify-center px-3 h-9 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 shadow-sm transition-all duration-150 hover:bg-indigo-700 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {busy(p.id) ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : 'Ativar agora'}
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/polls/${p.id}`)}
                      disabled={busy(p.id)}
                      className="w-full sm:w-auto lg:w-full inline-flex items-center justify-center px-3 h-9 border border-gray-200 rounded-lg text-sm font-medium text-gray-800 bg-white shadow-sm transition-all duration-150 hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50"
                    >
                      <EyeIcon className="h-4 w-4 mr-1" />
                      Editar
                    </button>

                    <Menu as="div" className="relative w-full sm:w-auto lg:w-full">
                      <MenuButton
                        disabled={busy(p.id)}
                        className="inline-flex w-full sm:w-auto lg:w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 h-9 text-sm font-medium text-gray-800 shadow-sm transition-all duration-150 hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98] data-[open]:border-indigo-200 data-[open]:bg-indigo-50/50 data-[open]:shadow-md data-[open]:ring-2 data-[open]:ring-indigo-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50"
                      >
                        <EllipsisVerticalIcon className="h-4 w-4 text-gray-500" aria-hidden />
                        Mais
                        <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                      </MenuButton>
                      <MenuItems
                        portal
                        transition
                        anchor="bottom end"
                        modal={false}
                        className="z-[100] w-60 origin-top-right rounded-xl border border-gray-200/90 bg-white p-1 shadow-xl outline-none [--anchor-gap:6px] transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
                      >
                        <MenuItem>
                          {({ focus }) => (
                            <button
                              type="button"
                              disabled={busy(p.id) || p.status !== 'active'}
                              onClick={() => handlePause(p.id)}
                              className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-gray-800 transition-colors disabled:opacity-40 ${focus ? 'bg-amber-50 text-amber-950' : ''}`}
                            >
                              Pausar
                            </button>
                          )}
                        </MenuItem>
                        <MenuItem>
                          {({ focus }) => (
                            <button
                              type="button"
                              disabled={busy(p.id) || p.status === 'closed'}
                              onClick={() => handleClose(p.id)}
                              className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-gray-800 transition-colors disabled:opacity-40 ${focus ? 'bg-gray-100' : ''}`}
                            >
                              Encerrar
                            </button>
                          )}
                        </MenuItem>
                        <MenuItem>
                          {({ focus }) => (
                            <button
                              type="button"
                              disabled={busy(p.id)}
                              onClick={() => handleDuplicate(p.id)}
                              className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-gray-800 transition-colors disabled:opacity-40 ${focus ? 'bg-indigo-50' : ''}`}
                            >
                              Duplicar
                            </button>
                          )}
                        </MenuItem>
                        {p.auto_open_on_app_launch ? (
                          <>
                            <MenuSeparator className="my-1 h-px bg-gray-100" />
                            <div className="px-2 py-2">
                              <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                Prioridade auto-abrir
                              </p>
                              <div className="mt-2 flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  disabled={busy(p.id)}
                                  onClick={() => bumpPriority(p, -1)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition-all hover:border-indigo-200 hover:bg-indigo-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
                                >
                                  <ChevronDownIcon className="h-4 w-4" />
                                </button>
                                <span className="min-w-[2rem] text-center text-sm font-semibold text-gray-900">
                                  {p.auto_open_priority}
                                </span>
                                <button
                                  type="button"
                                  disabled={busy(p.id)}
                                  onClick={() => bumpPriority(p, 1)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition-all hover:border-indigo-200 hover:bg-indigo-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
                                >
                                  <ChevronUpIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </>
                        ) : null}
                      </MenuItems>
                    </Menu>
                  </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
