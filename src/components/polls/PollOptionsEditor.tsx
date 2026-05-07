'use client';

import React, { useCallback, useMemo, useState } from 'react';
import type { PollLifecycleStatus, PollOptionInput } from '../../models/pollsTypes';
import { generateUuid } from '../../utils/idUtils';
import { PhotoIcon, PlusIcon } from '@heroicons/react/24/outline';
import { BBB26_PARTICIPANT_OPTIONS } from '../../data/bbb26ParticipantOptions';
import { getParticipantImageById, normalizeName } from '../../utils/avatarUtils';
import { ParticipantsPickerModal } from './ParticipantsPickerModal';

function sortById(options: PollOptionInput[]): PollOptionInput[] {
  return [...options].sort((a, b) => a.id.localeCompare(b.id));
}

/** Preview no painel: URL absoluta/manual ou avatar pelo slug (mesma lógica esperada no app). */
function resolveOptionPreviewUrl(o: PollOptionInput): string | null {
  const raw = o.image_url?.trim();
  if (raw) return raw;
  if (o.participant_id) {
    return getParticipantImageById(o.participant_id, BBB26_PARTICIPANT_OPTIONS);
  }
  return null;
}

function isParticipantAlreadyUsed(
  options: PollOptionInput[],
  p: { id: string; name: string }
): boolean {
  return options.some(
    (o) =>
      o.participant_id === p.id || normalizeName(o.label) === normalizeName(p.name)
  );
}

export function PollOptionsEditor(props: {
  pollId: string;
  pollStatus: PollLifecycleStatus;
  options: PollOptionInput[];
  onOptionsChange: (next: PollOptionInput[]) => void;
}) {
  const { pollId, pollStatus, options, onOptionsChange } = props;
  const canEditOptions = pollStatus !== 'closed';

  const sortedOptions = useMemo(() => sortById(options), [options]);

  const [newLabel, setNewLabel] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);

  const updateOptions = useCallback(
    (updater: (prev: PollOptionInput[]) => PollOptionInput[]) => {
      onOptionsChange(sortById(updater(sortedOptions)));
    },
    [sortedOptions, onOptionsChange]
  );

  const removeOption = useCallback(
    (optionId: string) => {
      if (!canEditOptions) return;
      updateOptions((prev) => prev.filter((o) => o.id !== optionId));
    },
    [canEditOptions, updateOptions]
  );

  const handleAddOption = useCallback(() => {
    if (!canEditOptions) return;
    const label = newLabel.trim();
    if (!label) return;

    const next: PollOptionInput = {
      id: generateUuid(),
      poll_id: pollId,
      label,
      image_url: newImageUrl.trim() ? newImageUrl.trim() : null,
      participant_id: null,
    };
    setNewLabel('');
    setNewImageUrl('');
    onOptionsChange(sortById([...sortedOptions, next]));
  }, [canEditOptions, newLabel, newImageUrl, pollId, sortedOptions, onOptionsChange]);

  const participantModalItems = useMemo(() => {
    return BBB26_PARTICIPANT_OPTIONS.map((p) => ({
      id: p.id,
      name: p.name,
      image_url: getParticipantImageById(p.id, BBB26_PARTICIPANT_OPTIONS),
      disabled: isParticipantAlreadyUsed(sortedOptions, p),
    }));
  }, [sortedOptions]);

  const handleConfirmParticipants = useCallback(
    (selectedIds: string[]) => {
      if (!canEditOptions) return;
      const selected = selectedIds
        .map((id) => BBB26_PARTICIPANT_OPTIONS.find((x) => x.id === id))
        .filter((p): p is (typeof BBB26_PARTICIPANT_OPTIONS)[number] => Boolean(p))
        .filter((p) => !isParticipantAlreadyUsed(sortedOptions, p));

      if (selected.length === 0) {
        setIsParticipantsModalOpen(false);
        return;
      }

      const nextOptions: PollOptionInput[] = selected.map((p) => ({
        id: generateUuid(),
        poll_id: pollId,
        label: p.name,
        image_url: null,
        participant_id: p.id,
      }));

      onOptionsChange(sortById([...sortedOptions, ...nextOptions]));
      setIsParticipantsModalOpen(false);
    },
    [canEditOptions, pollId, sortedOptions, onOptionsChange]
  );

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50/60 border border-indigo-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Participantes BBB26</h3>
        <p className="text-xs text-gray-600 mb-4">
          Grava o <span className="font-medium">participant_id</span> (slug) para o app carregar a foto localmente; URL relativa do site não vale no mobile.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <button
            type="button"
            onClick={() => setIsParticipantsModalOpen(true)}
            disabled={!canEditOptions}
            className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 h-[42px]"
          >
            Selecionar participantes…
          </button>
          <span className="text-xs text-gray-600">
            Clique para abrir a lista e marcar vários.
          </span>
        </div>
      </div>

      <ParticipantsPickerModal
        isOpen={isParticipantsModalOpen}
        items={participantModalItems}
        onClose={() => setIsParticipantsModalOpen(false)}
        onConfirm={handleConfirmParticipants}
      />

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <PlusIcon className="h-5 w-5 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-900">Adicionar opção manual</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Label</label>
            <input
              value={newLabel}
              disabled={!canEditOptions}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Texto da opção"
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Image URL (opcional)</label>
            <div className="relative">
              <PhotoIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={newImageUrl}
                disabled={!canEditOptions}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="URL da imagem"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleAddOption}
            disabled={!canEditOptions || !newLabel.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            Adicionar opção
          </button>
        </div>
      </div>

      {sortedOptions.length === 0 ? (
        <div className="text-sm text-gray-600 bg-white border border-gray-200 rounded-lg p-4">
          Nenhuma opção ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {sortedOptions.map((o, index) => {
            const updateOption = (patch: Partial<PollOptionInput>) => {
              updateOptions((prev) =>
                prev.map((item) => (item.id === o.id ? { ...item, ...patch } : item))
              );
            };
            const previewUrl = resolveOptionPreviewUrl(o);

            return (
              <div
                key={o.id}
                className="bg-white border border-gray-200 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-semibold text-gray-500 w-6 shrink-0">
                      {index + 1}
                    </span>
                    <div className="relative w-10 h-10 shrink-0 rounded-full overflow-hidden bg-gray-200 border border-gray-200">
                      {previewUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={previewUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <PhotoIcon className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{o.label}</div>
                      <div className="text-xs text-gray-400 truncate">
                        opção {o.id.slice(0, 8)}…
                        {o.participant_id ? (
                          <span className="ml-1">· participant_id: {o.participant_id}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!canEditOptions}
                    onClick={() => removeOption(o.id)}
                    className="shrink-0 px-2 py-1 rounded-md border border-red-200 bg-white text-red-700 text-sm hover:bg-red-50 disabled:opacity-50"
                  >
                    Remover
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Label</label>
                    <input
                      value={o.label}
                      disabled={!canEditOptions}
                      onChange={(e) => updateOption({ label: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Image URL</label>
                    <input
                      value={o.image_url ?? ''}
                      disabled={!canEditOptions}
                      onChange={(e) =>
                        updateOption({
                          image_url: e.target.value.trim() ? e.target.value.trim() : null,
                        })
                      }
                      placeholder="Opcional (sobrepõe preview se preenchido)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                {o.participant_id ? (
                  <p className="text-xs text-gray-500">
                    Foto no app: use o mapeamento por <code className="text-gray-700">participant_id</code>{' '}
                    (<code className="text-gray-700">{o.participant_id}</code>).
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
