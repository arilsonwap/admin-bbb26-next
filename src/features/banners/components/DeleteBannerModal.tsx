'use client';

import React from 'react';
import { Dialog, DialogBackdrop, DialogDescription, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { BannerAdmin } from '../../../models/bannersTypes';

type Props = {
  open: boolean;
  banner: BannerAdmin | null;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteBannerModal({ open, banner, loading, onConfirm, onCancel }: Props) {
  const label = (banner?.title?.trim() || banner?.id) ?? '';

  return (
    <Dialog open={open && !!banner} onClose={() => onCancel()} className="relative z-[60]">
      <DialogBackdrop className="fixed inset-0 bg-black/40" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="text-lg font-semibold text-gray-900">Excluir banner</DialogTitle>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
              aria-label="Fechar"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <DialogDescription className="mt-3 text-sm text-gray-600">
            Esta ação é <strong>irreversível</strong>. O banner{' '}
            <span className="font-medium text-gray-900">{label}</span> será removido e o JSON público será atualizado.
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              {loading ? 'Excluindo…' : 'Excluir definitivamente'}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
