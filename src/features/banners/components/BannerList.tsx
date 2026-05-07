'use client';

import React, { useCallback, useMemo } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { BannerAdmin } from '../../../models/bannersTypes';
import { BannerItem } from './BannerItem';

type Props = {
  banners: BannerAdmin[];
  reorderDisabled?: boolean;
  /** Só enquanto `reorder` está em voo — não bloqueia por save em outro banner. */
  reorderBusy?: boolean;
  /** Ativar / editar / excluir (evita corrida com update/delete/reorder). */
  actionsBusy?: boolean;
  onReorder: (orderedIds: string[]) => void;
  onEdit: (b: BannerAdmin) => void;
  onDelete: (b: BannerAdmin) => void;
  onToggleActive: (b: BannerAdmin) => void;
};

export function BannerList({
  banners,
  reorderDisabled = false,
  reorderBusy = false,
  actionsBusy = false,
  onReorder,
  onEdit,
  onDelete,
  onToggleActive,
}: Props) {
  const dragDisabled = reorderDisabled || reorderBusy;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = useMemo(() => banners.map((b) => b.id), [banners]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (reorderDisabled || reorderBusy || !over || active.id === over.id) return;

      const oldIndex = banners.findIndex((b) => b.id === String(active.id));
      const newIndex = banners.findIndex((b) => b.id === String(over.id));

      if (oldIndex < 0 || newIndex < 0) return;

      const next = arrayMove(banners, oldIndex, newIndex);
      onReorder(next.map((b) => b.id));
    },
    [reorderDisabled, reorderBusy, banners, onReorder]
  );

  if (banners.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
        Nenhum banner cadastrado.
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="space-y-4">
          {banners.map((b) => (
            <BannerItem
              key={b.id}
              banner={b}
              reorderDisabled={dragDisabled}
              actionsBusy={actionsBusy}
              onEdit={() => onEdit(b)}
              onDelete={() => onDelete(b)}
              onToggleActive={() => onToggleActive(b)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
