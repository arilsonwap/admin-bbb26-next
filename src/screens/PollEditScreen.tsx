'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { PollLifecycleStatus, PollOptionInput, PollType } from '../models/pollsTypes';
import {
  getPoll,
  updatePoll,
  publishPoll,
  closePoll,
  pausePoll,
} from '../services/pollsAdminClient';
import { useNotifications } from '../hooks/useNotifications';
import { PollOptionsEditor } from '../components/polls/PollOptionsEditor';
import { PollStatusBadge } from '../components/polls/PollStatusBadge';
import { Card } from '../components/common/Card';
import { ToastContainer } from '../components/ui/Toast';
import { PollUpdatePayloadSchema } from '../models/pollsSchemas';

export function PollEditScreen() {
  const router = useRouter();
  const { showError, showSuccess, showWarning, toasts, removeToast } = useNotifications();
  const params = useParams<{ pollId: string | string[] }>();
  const pollId = useMemo(() => {
    const raw = params?.pollId;
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw) && raw[0]) return raw[0];
    return undefined;
  }, [params]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [status, setStatus] = useState<PollLifecycleStatus>('draft');
  const [type, setType] = useState<PollType | ''>('');
  const [typeTouched, setTypeTouched] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [openAtLocal, setOpenAtLocal] = useState('');
  const [closeAtEnabled, setCloseAtEnabled] = useState(false);
  const [closeAtLocal, setCloseAtLocal] = useState('');
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoPriority, setAutoPriority] = useState(0);
  const [showInHub, setShowInHub] = useState(true);
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
  const [options, setOptions] = useState<PollOptionInput[]>([]);

  const toLocalInputValue = useCallback((iso: string | null | undefined): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}`;
  }, []);

  const toIsoOrNull = useCallback((localValue: string, enabled: boolean): string | null => {
    if (!enabled) return null;
    const v = localValue.trim();
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }, []);

  const load = useCallback(async () => {
    if (!pollId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await getPoll(pollId);
      setStatus(data.poll.status);
      setType(data.poll.type ?? '');
      setTitle(data.poll.title);
      setDescription(data.poll.description ?? '');
      setOpenAtLocal(toLocalInputValue(data.poll.open_at ?? null));
      const closeIso = data.poll.close_at ?? null;
      setCloseAtEnabled(Boolean(closeIso));
      setCloseAtLocal(toLocalInputValue(closeIso));
      setAutoOpen(data.poll.auto_open_on_app_launch);
      setAutoPriority(data.poll.auto_open_priority);
      setShowInHub(data.poll.show_in_home_hub);
      setAllowMultipleVotes(data.poll.allow_multiple_votes);
      setOptions(
        data.options.map((o) => ({
          id: o.id,
          poll_id: o.poll_id,
          label: o.label,
          image_url: o.image_url ?? null,
        }))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      showError('Erro ao carregar', message);
    } finally {
      setIsLoading(false);
    }
  }, [pollId, showError, toLocalInputValue]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = status !== 'closed';

  const handleSave = useCallback(async () => {
    if (!pollId) return;
    if (status === 'closed') {
      showWarning('Bloqueado', 'Enquete encerrada não pode ser editada.');
      return;
    }
    setTypeTouched(true);
    if (type === '') {
      showError('Validação', 'Selecione o destino.');
      return;
    }

    setIsSaving(true);
    try {
      const openIso = toIsoOrNull(openAtLocal, true);
      const closeIso = toIsoOrNull(closeAtLocal, closeAtEnabled);

      const payload = {
        poll: {
          title: title.trim(),
          description: description.trim() || null,
          status,
          type: type as PollType,
          open_at: openIso,
          close_at: closeIso,
          auto_open_on_app_launch: autoOpen,
          auto_open_priority: autoPriority,
          show_in_home_hub: showInHub,
          allow_multiple_votes: allowMultipleVotes,
        },
        options: options.map((o) => ({
          id: o.id,
          poll_id: pollId,
          label: o.label,
          image_url: o.image_url ?? null,
          participant_id: o.participant_id ?? null,
        })),
      };

      const parsed = PollUpdatePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        showError(
          'Dados inválidos',
          parsed.error.issues.map((i) => i.message).slice(0, 4).join('; ')
        );
        return;
      }

      await updatePoll({ pollId, poll: payload.poll, options: payload.options });
      showSuccess('Salvo', 'Alterações aplicadas.');
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      showError('Erro ao salvar', message);
    } finally {
      setIsSaving(false);
    }
  }, [
    pollId,
    status,
    type,
    title,
    description,
    openAtLocal,
    closeAtEnabled,
    closeAtLocal,
    autoOpen,
    autoPriority,
    showInHub,
    allowMultipleVotes,
    options,
    showError,
    showSuccess,
    showWarning,
    load,
    toIsoOrNull,
  ]);

  const isLive = status === 'active';

  const handlePublish = useCallback(async () => {
    if (!pollId) return;
    if (status === 'active' || status === 'closed') return;

    try {
      setIsSaving(true);
      await publishPoll(pollId);
      showSuccess('Ativada', 'Enquete publicada.');
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      showError('Erro ao ativar', message);
    } finally {
      setIsSaving(false);
    }
  }, [pollId, status, showSuccess, showError, load]);

  const handlePause = useCallback(async () => {
    if (!pollId || status !== 'active') return;
    try {
      setIsSaving(true);
      await pausePoll(pollId);
      showSuccess('Pausada', '');
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      showError('Erro ao pausar', message);
    } finally {
      setIsSaving(false);
    }
  }, [pollId, status, showSuccess, showError, load]);

  const handleClose = useCallback(async () => {
    if (!pollId) return;
    if (status === 'closed') return;

    if (!confirm('Encerrar esta enquete?')) return;

    try {
      setIsSaving(true);
      await closePoll(pollId);
      showSuccess('Encerrada', '');
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      showError('Erro ao encerrar', message);
    } finally {
      setIsSaving(false);
    }
  }, [pollId, status, showSuccess, showError, load]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-600 bg-white border border-gray-200 rounded-lg p-4">Carregando...</div>
      </div>
    );
  }

  if (!pollId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-gray-700">ID ausente.</p>
        <button
          type="button"
          onClick={() => router.push('/polls')}
          className="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="hidden lg:block bg-white/90 backdrop-blur shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-semibold text-gray-900 truncate">Editar enquete</h1>
                <PollStatusBadge status={status} />
              </div>
              <div className="text-xs text-gray-500 truncate mt-1">ID: {pollId}</div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!canEdit || isSaving}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                type="button"
                onClick={() => void handlePublish()}
                disabled={status === 'active' || status === 'closed' || isSaving}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-700 hover:bg-green-800 disabled:opacity-50"
              >
                Ativar agora
              </button>
              <button
                type="button"
                onClick={() => void handlePause()}
                disabled={status !== 'active' || isSaving}
                className="inline-flex items-center px-4 py-2 border border-amber-300 rounded-md text-sm font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 disabled:opacity-50"
              >
                Pausar
              </button>
              <button
                type="button"
                onClick={() => void handleClose()}
                disabled={status === 'closed' || isSaving}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
              >
                Encerrar
              </button>

              <button
                type="button"
                onClick={() => router.push('/polls')}
                className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Lista
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8 pb-24 lg:pb-6">
        <div className="space-y-6">
          <Card>
            {status === 'closed' ? (
              <div className="mb-4 text-sm text-gray-800 bg-gray-100 border border-gray-200 rounded-lg p-3">
                Encerrada — somente leitura.
              </div>
            ) : isLive ? (
              <div className="mb-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Enquete ativa. Use <b>Pausar</b> ou <b>Encerrar</b> para mudar o ciclo.
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Título</label>
                <input
                  value={title}
                  disabled={!canEdit || isSaving}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Destino</label>
                <select
                  value={type}
                  disabled={!canEdit || isSaving}
                  onChange={(e) => setType(e.target.value as PollType | '')}
                  onBlur={() => setTypeTouched(true)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm disabled:bg-gray-50"
                >
                  <option value="">Selecione...</option>
                  <option value="home">Home</option>
                  <option value="paredao">Paredão</option>
                </select>
                {typeTouched && type === '' ? (
                  <div className="text-xs text-red-700">Obrigatório.</div>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Prioridade auto-abrir</label>
                <input
                  type="number"
                  min={0}
                  value={autoPriority}
                  disabled={!canEdit || isSaving || !autoOpen}
                  onChange={(e) => setAutoPriority(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm disabled:bg-gray-50"
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="block text-sm font-medium text-gray-700">Descrição</label>
              <textarea
                value={description}
                disabled={!canEdit || isSaving}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm disabled:bg-gray-50"
              />
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Abrir em</label>
                <input
                  type="datetime-local"
                  value={openAtLocal}
                  disabled={!canEdit || isSaving}
                  onChange={(e) => setOpenAtLocal(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm disabled:bg-gray-50"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-gray-700">Fechar em</label>
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={closeAtEnabled}
                      disabled={!canEdit || isSaving}
                      onChange={(e) => {
                        const c = e.target.checked;
                        setCloseAtEnabled(c);
                        if (!c) setCloseAtLocal('');
                      }}
                    />
                    Definir
                  </label>
                </div>
                <input
                  type="datetime-local"
                  value={closeAtLocal}
                  disabled={!canEdit || isSaving || !closeAtEnabled}
                  onChange={(e) => setCloseAtLocal(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm disabled:bg-gray-50"
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={autoOpen}
                  disabled={!canEdit || isSaving}
                  onChange={(e) => setAutoOpen(e.target.checked)}
                />
                Auto-abrir no app
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={showInHub}
                  disabled={!canEdit || isSaving || type !== 'home'}
                  onChange={(e) => setShowInHub(e.target.checked)}
                />
                Hub Home
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-800 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={allowMultipleVotes}
                  disabled={!canEdit || isSaving}
                  onChange={(e) => setAllowMultipleVotes(e.target.checked)}
                />
                Múltiplos votos
              </label>
            </div>
          </Card>

          <Card>
            <PollOptionsEditor
              pollId={pollId}
              pollStatus={status}
              options={options}
              onOptionsChange={setOptions}
            />
          </Card>
        </div>
      </main>

      <nav
        aria-label="Ações"
        className="lg:hidden fixed bottom-0 inset-x-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur px-2 py-2"
      >
        <div className="max-w-6xl mx-auto flex flex-wrap gap-2 justify-center">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!pollId || !canEdit || isSaving}
            className="inline-flex items-center px-3 py-2 rounded-md text-xs font-medium text-white bg-indigo-600 disabled:opacity-50"
          >
            Salvar
          </button>
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={!pollId || status === 'active' || status === 'closed' || isSaving}
            className="inline-flex items-center px-3 py-2 rounded-md text-xs font-medium text-white bg-green-700 disabled:opacity-50"
          >
            Ativar
          </button>
          <button
            type="button"
            onClick={() => void handlePause()}
            disabled={!pollId || status !== 'active' || isSaving}
            className="inline-flex items-center px-3 py-2 rounded-md text-xs font-medium text-amber-900 bg-amber-100 disabled:opacity-50"
          >
            Pausar
          </button>
          <button
            type="button"
            onClick={() => void handleClose()}
            disabled={!pollId || status === 'closed' || isSaving}
            className="inline-flex items-center px-3 py-2 rounded-md text-xs font-medium text-white bg-gray-800 disabled:opacity-50"
          >
            Encerrar
          </button>
          <button
            type="button"
            onClick={() => router.push('/polls')}
            className="inline-flex items-center px-3 py-2 rounded-md text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200"
          >
            Lista
          </button>
        </div>
      </nav>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
