'use client';

import React, { useEffect, useState } from 'react';
import { BannerCreatePayloadSchema, BannerUpdatePayloadSchema } from '../../../models/bannersSchemas';
import type { BannerAdmin, BannerCreatePayload, BannerUpdatePayload } from '../../../models/bannersTypes';
import { BannerPreview } from './BannerPreview';

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

function validateHttpUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return 'Informe a URL da imagem.';
  try {
    const u = new URL(t);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return 'A URL deve começar com http:// ou https://';
    }
    return null;
  } catch {
    return 'URL inválida.';
  }
}

type Mode = 'create' | 'edit';

type Props = {
  mode: Mode;
  section: string;
  initial?: BannerAdmin | null;
  nextSortOrder: number;
  /** Retorne true se salvou com sucesso (toast/close ficam no pai). */
  onCreate: (payload: BannerCreatePayload) => Promise<boolean>;
  onUpdate: (bannerId: string, payload: BannerUpdatePayload) => Promise<boolean>;
  onCancel: () => void;
};

export function BannerForm({ mode, section, initial, nextSortOrder, onCreate, onUpdate, onCancel }: Props) {
  const [values, setValues] = useState<BannerFormValues>(() => emptyValues(nextSortOrder));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setFormError(null);
    if (mode === 'edit' && initial) {
      setValues(fromBanner(initial));
    } else {
      setValues(emptyValues(nextSortOrder));
    }
  }, [mode, initial, nextSortOrder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const urlErr = validateHttpUrl(values.imageUrl);
    if (urlErr) {
      setFormError(urlErr);
      return;
    }

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
        const ok = await onCreate(parsed.data);
        if (!ok) return;
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
      const ok = await onUpdate(initial.id, parsed.data);
      if (!ok) return;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
      <div className="space-y-4 px-4 py-4">
        {formError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {formError}
          </div>
        ) : null}

        <div>
          <label className="block text-sm font-medium text-gray-700">Título (opcional)</label>
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            placeholder="Identificação interna"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Subtítulo (opcional)</label>
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
            autoComplete="off"
          />
        </div>
        <BannerPreview imageUrl={values.imageUrl} className="min-h-[120px]" />
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
            <label className="block text-sm font-medium text-gray-700">Ordem (opcional)</label>
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
          <label className="block text-sm font-medium text-gray-700">Notas (opcional, só admin)</label>
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
          onClick={onCancel}
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
  );
}
