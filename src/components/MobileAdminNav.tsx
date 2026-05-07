'use client';

import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { SidebarNavContent } from './Sidebar';

export const MobileAdminNav: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Abrir menu"
          onClick={() => setOpen(true)}
        >
          <Bars3Icon className="h-6 w-6" aria-hidden />
        </button>
        <span className="text-sm font-semibold text-gray-900">Admin BBB26</span>
      </div>

      <Dialog open={open} onClose={setOpen} className="relative z-50 lg:hidden">
        <div className="fixed inset-0 bg-black/40" aria-hidden />

        <div className="fixed inset-0 flex">
          <DialogPanel className="relative flex h-full w-full max-w-[min(100%,20rem)] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <DialogTitle className="text-base font-semibold text-gray-900">Menu</DialogTitle>
              <button
                type="button"
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Fechar menu"
                onClick={() => setOpen(false)}
              >
                <XMarkIcon className="h-6 w-6" aria-hidden />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6">
              <SidebarNavContent onLinkClick={() => setOpen(false)} />
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
};
