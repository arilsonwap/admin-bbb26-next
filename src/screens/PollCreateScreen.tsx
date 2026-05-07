'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateUuid } from '../utils/idUtils';
import type { PollLifecycleStatus, PollOptionInput, PollType } from '../models/pollsTypes';
import { PollOptionsEditor } from '../components/polls/PollOptionsEditor';
import { useNotifications } from '../hooks/useNotifications';
import { createPoll } from '../services/pollsAdminClient';
import { Card } from '../components/common/Card';
import { ToastContainer } from '../components/ui/Toast';
import { PollStatusBadge } from '../components/polls/PollStatusBadge';
import { PollCreatePayloadSchema } from '../models/pollsSchemas';

export function PollCreateScreen() {
  const router = useRouter();
  const { showError, showSuccess, toasts, removeToast } = useNotifications();

  const pollId = useMemo(() => generateUuid(), []);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<PollType | ''>('');
  const [typeTouched, setTypeTouched] = useState(false);
  const [openAtLocal, setOpenAtLocal] = useState('');
  const [closeAtEnabled, setCloseAtEnabled] = useState(false);
  const [closeAtLocal, setCloseAtLocal] = useState('');
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoPriority, setAutoPriority] = useState(0);
  const [showInHub, setShowInHub] = useState(true);
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
  const [options, setOptions] = useState<PollOptionInput[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const toIsoOrNull = useCallback((localValue: string, enabled: boolean): string | null => {
    if (!enabled) return null;
    const v = localValue.trim();
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }, []);

  const derivedStatus = useMemo((): PollLifecycleStatus => {
    const openIso = toIsoOrNull(openAtLocal, true);
    if (openIso && new Date(openIso) > new Date()) return 'scheduled';
    return 'draft';
  }, [openAtLocal, toIsoOrNull]);

  const canSave = title.trim().length > 0 && type !== '';

  const handleSave = useCallback(async () => {
    setTypeTouched(true);
    if (!canSave) {
      if (type === '') showError('Validação', 'Selecione o destino (home ou paredão).');
      return;
    }

    setIsSaving(true);
    try {
      const openIso = toIsoOrNull(openAtLocal, true);
      const closeIso = toIsoOrNull(closeAtLocal, closeAtEnabled);
      const status: PollLifecycleStatus =
        openIso && new Date(openIso) > new Date() ? 'scheduled' : 'draft';

      const payload = {
        poll: {
          id: pollId,
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

      const parsed = PollCreatePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        showError(
          'Dados inválidos',
          parsed.error.issues.map((i) => i.message).slice(0, 4).join('; ')
        );
        return;
      }

      await createPoll(payload);
      showSuccess('Enquete criada', status === 'scheduled' ? 'Agendada.' : 'Rascunho salvo.');
      router.push(`/polls/${encodeURIComponent(pollId)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      showError('Erro ao criar', message);
    } finally {
      setIsSaving(false);
    }
  }, [
    canSave,
    title,
    description,
    type,
    openAtLocal,
    closeAtEnabled,
    closeAtLocal,
    autoOpen,
    autoPriority,
    showInHub,
    allowMultipleVotes,
    options,
    pollId,
    showError,
    showSuccess,
    router,
    toIsoOrNull,
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="hidden lg:block bg-white/90 backdrop-blur shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-semibold text-gray-900">Nova enquete</h1>
            <PollStatusBadge status={derivedStatus} />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-900">Dados</h2>
              <button
                type="button"
                disabled={!canSave || isSaving}
                onClick={() => void handleSave()}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Título</label>
                <input
                  value={title}
                  disabled={isSaving}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Destino</label>
                <select
                  value={type}
                  disabled={isSaving}
                  onChange={(e) => setType(e.target.value as PollType | '')}
                  onBlur={() => setTypeTouched(true)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  disabled={isSaving || !autoOpen}
                  onChange={(e) => setAutoPriority(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
                />
              </div>
            </div>

            <div className="mt-4 space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Descrição</label>
              <textarea
                value={description}
                disabled={isSaving}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Abrir em (open_at)</label>
                <input
                  type="datetime-local"
                  value={openAtLocal}
                  disabled={isSaving}
                  onChange={(e) => setOpenAtLocal(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-gray-700">Fechar em (close_at)</label>
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={closeAtEnabled}
                      disabled={isSaving}
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
                  disabled={isSaving || !closeAtEnabled}
                  onChange={(e) => setCloseAtLocal(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={autoOpen}
                  disabled={isSaving}
                  onChange={(e) => setAutoOpen(e.target.checked)}
                />
                Auto-abrir no app ao iniciar
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={showInHub}
                  disabled={isSaving || type !== 'home'}
                  onChange={(e) => setShowInHub(e.target.checked)}
                />
                Mostrar no hub da Home (tipo home)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-800 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={allowMultipleVotes}
                  disabled={isSaving}
                  onChange={(e) => setAllowMultipleVotes(e.target.checked)}
                />
                Permitir múltiplos votos (mesmo dispositivo / utilizador)
              </label>
            </div>
          </Card>

          <Card>
            <PollOptionsEditor
              pollId={pollId}
              pollStatus="draft"
              options={options}
              onOptionsChange={setOptions}
            />
          </Card>
        </div>
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
