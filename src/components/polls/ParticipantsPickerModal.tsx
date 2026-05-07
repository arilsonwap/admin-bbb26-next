'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export type ParticipantsPickerItem = {
  id: string;
  name: string;
  image_url?: string | null;
  disabled?: boolean;
};

export function ParticipantsPickerModal(props: {
  isOpen: boolean;
  title?: string;
  items: ParticipantsPickerItem[];
  initialSelectedIds?: string[];
  confirmText?: string;
  cancelText?: string;
  onConfirm: (selectedIds: string[]) => void;
  onClose: () => void;
}) {
  const {
    isOpen,
    title = 'Selecionar participantes',
    items,
    initialSelectedIds = [],
    confirmText = 'Adicionar selecionados',
    cancelText = 'Cancelar',
    onConfirm,
    onClose,
  } = props;

  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));
  const searchRef = useRef<HTMLInputElement>(null);
  const initialSelectedIdsRef = useRef<string[]>(initialSelectedIds);
  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    const id = window.setTimeout(() => setQuery(queryInput), 150);
    return () => window.clearTimeout(id);
  }, [queryInput]);

  useEffect(() => {
    initialSelectedIdsRef.current = initialSelectedIds;
  }, [initialSelectedIds]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;
    if (!isOpen || wasOpen) return;

    setQueryInput('');
    setQuery('');
    setSelectedIds(new Set(initialSelectedIdsRef.current));
    setTimeout(() => searchRef.current?.focus(), 100);
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => x.name.toLowerCase().includes(q));
  }, [items, query]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const ids = Array.from(selectedIds);
    onConfirm(ids);
  }, [onConfirm, selectedIds]);

  if (!isOpen) return null;

  const selectedCount = selectedIds.size;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div
          className="relative inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:align-middle"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-gray-200">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-lg font-medium leading-6 text-gray-900 truncate">{title}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedCount} selecionado{selectedCount === 1 ? '' : 's'}
                </p>
              </div>
              <button type="button" onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-4">
              <input
                ref={searchRef}
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Buscar participante..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="bg-white px-4 sm:px-6 py-4">
            {filtered.length === 0 ? (
              <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-4">Nada encontrado.</div>
            ) : (
              <div className="max-h-[52vh] overflow-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {filtered.map((p) => {
                  const disabled = Boolean(p.disabled);
                  const checked = selectedIds.has(p.id);
                  return (
                    <label
                      key={p.id}
                      aria-disabled={disabled}
                      className={[
                        'w-full flex items-center gap-3 px-3 py-2 text-left',
                        disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:bg-indigo-50',
                      ].join(' ')}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggle(p.id)}
                        className="h-4 w-4 accent-indigo-600"
                      />
                      <div className="relative w-9 h-9 shrink-0 rounded-full overflow-hidden bg-gray-200 border border-gray-200">
                        {p.image_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                        <div className="text-xs text-gray-400 truncate">{p.id}</div>
                      </div>
                      {disabled ? <span className="text-xs text-gray-500">já usado</span> : null}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              className="inline-flex justify-center w-full px-4 py-2 text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 sm:ml-3 sm:w-auto sm:text-sm"
            >
              {confirmText}
            </button>
            <button
              type="button"
              className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
              onClick={onClose}
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

