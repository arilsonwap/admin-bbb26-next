'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogBackdrop, DialogDescription, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { BannersApiError, getPublicPayloadForSection } from '../services/bannersClient';

type Props = {
  open: boolean;
  section: string;
  onClose: () => void;
};

export function PublicJsonModal({ open, section, onClose }: Props) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await getPublicPayloadForSection(section);
      setText(JSON.stringify(payload, null, 2));
    } catch (e) {
      const msg =
        e instanceof BannersApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Erro ao carregar JSON';
      setError(msg);
      setText('');
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    void load();
  }, [open, load]);

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Não foi possível copiar.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-[60]">
      <DialogBackdrop className="fixed inset-0 bg-black/40" />
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
        <DialogPanel className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
            <div>
              <DialogTitle className="text-lg font-semibold text-gray-900">JSON público</DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Mesmo conteúdo de getPublicPayloadForSection(&quot;{section}&quot;)
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Atualizar
              </button>
              <button
                type="button"
                onClick={copy}
                disabled={loading || !text}
                className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                <ClipboardDocumentIcon className="h-4 w-4" />
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Fechar"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {loading ? (
              <div className="space-y-2">
                <div className="h-4 animate-pulse rounded bg-gray-200" />
                <div className="h-4 animate-pulse rounded bg-gray-200" />
                <div className="h-32 animate-pulse rounded bg-gray-100" />
              </div>
            ) : null}
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
            ) : null}
            {!loading && !error ? (
              <pre className="max-h-[60vh] overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-green-100">{text}</pre>
            ) : null}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
