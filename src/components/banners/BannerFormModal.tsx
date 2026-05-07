'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { BannerCreatePayloadSchema, BannerUpdatePayloadSchema } from '../../models/bannersSchemas';
import type { BannerAdmin, BannerCreatePayload, BannerUpdatePayload } from '../../models/bannersTypes';
import { BannerImagePreview } from './BannerImagePreview';

type Mode = 'create' | 'edit';

export type BannerFormValues = {
  title: string;
  subtitle: string;
  imageUrl: string;
  targetUrl: string;
  active: boolean;
  sortOrder: string;
  startsAt: string;
  endsAt: string;
  tags: string;
  notes: string;
};

function emptyValues(sortHint: number): BannerFormValues {
  return {
    title: '',
    subtitle: '',
    imageUrl: '',
    targetUrl: '',
    active: true,
    sortOrder: String(sortHint),
    startsAt: '',
    endsAt: '',
    tags: '',
    notes: '',
  };
}

function isoToLocalDatetimeValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromBanner(b: BannerAdmin): BannerFormValues {
  return {
    title: b.title ?? '',
    subtitle: b.subtitle ?? '',
    imageUrl: b.imageUrl,
    targetUrl: b.targetUrl ?? '',
    active: b.active,
    sortOrder: String(b.sortOrder),
    startsAt: isoToLocalDatetimeValue(b.startsAt),
    endsAt: isoToLocalDatetimeValue(b.endsAt),
    tags: b.tags?.join(', ') ?? '',
    notes: b.notes ?? '',
  };
}

function toIsoOptionalLocal(dt: string): string | null {
  if (!dt.trim()) return null;
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

type Props = {
  open: boolean;
  mode: Mode;
  section: string;
  initial?: BannerAdmin | null;
  nextSortOrder: number;
  onClose: () => void;
  onCreate: (payload: BannerCreatePayload) => Promise<void>;
  onUpdate: (bannerId: string, payload: BannerUpdatePayload) => Promise<void>;
};

export function BannerFormModal({
  open,
  mode,
  section,
  initial,
  nextSortOrder,
  onClose,
  onCreate,
  onUpdate,
}: Props) {
  const [values, setValues] = useState<BannerFormValues>(() => emptyValues(nextSortOrder));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (mode === 'edit' && initial) {
      setValues(fromBanner(initial));
    } else {
      setValues(emptyValues(nextSortOrder));
    }
  }, [open, mode, initial, nextSortOrder]);

  const title = useMemo(() => (mode === 'create' ? 'Novo banner' : 'Editar banner'), [mode]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const sortNum = Number.parseInt(values.sortOrder, 10);
    if (Number.isNaN(sortNum)) {
      setFormError('Ordem deve ser um número inteiro.');
      return;
    }

    const tagsArr = values.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const startsAt = toIsoOptionalLocal(values.startsAt);
    const endsAt = toIsoOptionalLocal(values.endsAt);

    if (mode === 'create') {
      const raw = {
        section,
        title: values.title.trim() || undefined,
        subtitle: values.subtitle.trim() || undefined,
        imageUrl: values.imageUrl.trim(),
        targetUrl: values.targetUrl.trim() || null,
        active: values.active,
        sortOrder: sortNum,
        startsAt,
        endsAt,
        tags: tagsArr.length ? tagsArr : undefined,
        notes: values.notes.trim() || undefined,
      };
      const parsed = BannerCreatePayloadSchema.safeParse(raw);
      if (!parsed.success) {
        setFormError('Verifique os campos obrigatórios e as URLs.');
        return;
      }
      setSubmitting(true);
      try {
        await onCreate(parsed.data);
        onClose();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Erro ao salvar');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!initial) return;

    const raw = {
      section,
      title: values.title.trim() || null,
      subtitle: values.subtitle.trim() || null,
      imageUrl: values.imageUrl.trim(),
      targetUrl: values.targetUrl.trim() || null,
      active: values.active,
      sortOrder: sortNum,
      startsAt,
      endsAt,
      tags: tagsArr.length ? tagsArr : null,
      notes: values.notes.trim() || null,
    };
    const parsed = BannerUpdatePayloadSchema.safeParse(raw);
    if (!parsed.success) {
      setFormError('Verifique os campos e as URLs.');
      return;
    }
    setSubmitting(true);
    try {
      await onUpdate(initial.id, parsed.data);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="space-y-4 px-4 py-4">
            {formError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {formError}
              </div>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-gray-700">Título (admin)</label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={values.title}
                onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
                placeholder="Identificação interna"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Subtítulo (admin)</label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={values.subtitle}
                onChange={(e) => setValues((v) => ({ ...v, subtitle: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                URL da imagem <span className="text-red-600">*</span>
              </label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
                value={values.imageUrl}
                onChange={(e) => setValues((v) => ({ ...v, imageUrl: e.target.value }))}
                placeholder="https://..."
                required
              />
            </div>
            <BannerImagePreview imageUrl={values.imageUrl} className="min-h-[120px]" />
            <div>
              <label className="block text-sm font-medium text-gray-700">URL de destino (opcional)</label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
                value={values.targetUrl}
                onChange={(e) => setValues((v) => ({ ...v, targetUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Ordem</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={values.sortOrder}
                  onChange={(e) => setValues((v) => ({ ...v, sortOrder: e.target.value }))}
                  min={0}
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={values.active}
                    onChange={(e) => setValues((v) => ({ ...v, active: e.target.checked }))}
                  />
                  Ativo
                </label>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Início (opcional)</label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={values.startsAt}
                  onChange={(e) => setValues((v) => ({ ...v, startsAt: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Fim (opcional)</label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={values.endsAt}
                  onChange={(e) => setValues((v) => ({ ...v, endsAt: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Tags (opcional, separadas por vírgula)</label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={values.tags}
                onChange={(e) => setValues((v) => ({ ...v, tags: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Notas (só admin)</label>
              <textarea
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                rows={2}
                value={values.notes}
                onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {submitting ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
