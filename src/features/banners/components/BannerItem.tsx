'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Bars3Icon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { BannerAdmin } from '../../../models/bannersTypes';
import { BannerPreview } from './BannerPreview';

function truncateUrl(url: string, max = 72): string {
  if (url.length <= max) return url;
  return `${url.slice(0, max - 1)}…`;
}

type Props = {
  banner: BannerAdmin;
  reorderDisabled?: boolean;
  actionsBusy?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
};

export function BannerItem({
  banner: b,
  reorderDisabled,
  actionsBusy = false,
  onEdit,
  onDelete,
  onToggleActive,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: b.id,
    disabled: reorderDisabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 p-4 sm:flex-row">
        <div className="flex shrink-0 gap-2 sm:flex-col sm:items-center">
          <button
            type="button"
            className={[
              'rounded-md border border-gray-200 p-2 text-gray-500 hover:bg-gray-50',
              reorderDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-grab active:cursor-grabbing',
            ].join(' ')}
            disabled={reorderDisabled}
            aria-label="Arrastar para reordenar"
            {...attributes}
            {...listeners}
          >
            <Bars3Icon className="h-5 w-5" />
          </button>
          <div className="w-full shrink-0 sm:w-40">
            <BannerPreview imageUrl={b.imageUrl} alt={b.title ?? b.id} className="min-h-[100px]" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900">{b.title?.trim() ? b.title : 'Sem título'}</span>
            <span
              className={[
                'rounded-full px-2 py-0.5 text-xs font-medium',
                b.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600',
              ].join(' ')}
            >
              {b.active ? 'Ativo' : 'Inativo'}
            </span>
            <span className="text-xs text-gray-500">Ordem {b.sortOrder}</span>
          </div>
          <p className="mt-1 font-mono text-xs text-gray-600" title={b.imageUrl}>
            {truncateUrl(b.imageUrl)}
          </p>
          {b.targetUrl ? (
            <p className="mt-0.5 truncate font-mono text-xs text-indigo-600" title={b.targetUrl}>
              → {b.targetUrl}
            </p>
          ) : null}
        </div>
        <div className="flex flex-row flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          <button
            type="button"
            onClick={onToggleActive}
            disabled={actionsBusy}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {b.active ? 'Desativar' : 'Ativar'}
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={actionsBusy}
            className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
          >
            <PencilSquareIcon className="h-4 w-4" />
            Editar
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={actionsBusy}
            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4" />
            Excluir
          </button>
        </div>
      </div>
    </li>
  );
}
