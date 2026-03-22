'use client';

import React, { useEffect, useRef, ReactNode } from 'react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface ModalConfirmProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmButtonColor?: 'blue' | 'red' | 'green';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ModalConfirm: React.FC<ModalConfirmProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  confirmButtonColor = 'blue',
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focar no botão de confirmar quando o modal abrir
      setTimeout(() => confirmButtonRef.current?.focus(), 100);

      // Prevenir scroll do body
      document.body.style.overflow = 'hidden';

      // Adicionar listener para ESC
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onCancel();
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const getConfirmButtonClasses = () => {
    const baseClasses = 'inline-flex justify-center w-full px-4 py-2 text-base font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm';

    switch (confirmButtonColor) {
      case 'red':
        return `${baseClasses} border-transparent text-white bg-red-600 hover:bg-red-700 focus:ring-red-500`;
      case 'green':
        return `${baseClasses} border-transparent text-white bg-green-600 hover:bg-green-700 focus:ring-green-500`;
      default:
        return `${baseClasses} border-transparent text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay - z-0 para ficar atrás do painel */}
        <div
          className="fixed inset-0 z-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={() => {
            if (!isLoading) onCancel();
          }}
        />

        {/* Modal panel - z-10 para ficar acima do overlay */}
        <div
          ref={modalRef}
          className="relative z-10 inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle"
        >
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  {title}
                </h3>
                <div className="mt-2">
                  {typeof message === 'string' ? (
                    <p className="text-sm text-gray-500">
                      {message}
                    </p>
                  ) : (
                    <div className="text-sm text-gray-500">
                      {message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button
              ref={confirmButtonRef}
              type="button"
              className={getConfirmButtonClasses()}
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? 'Processando...' : confirmText}
            </button>
            <button
              type="button"
              className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={onCancel}
              disabled={isLoading}
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalConfirm;