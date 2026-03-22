import React, { useCallback } from 'react';
import {
  ArrowLeftIcon,
  CloudArrowUpIcon,
  CloudArrowDownIcon,
  DocumentCheckIcon,
  EyeIcon,
  PencilIcon,
  BackspaceIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

// Componentes auxiliares para reduzir duplicação
const ActionButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
}> = ({ children, onClick, disabled, className, title }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={clsx(
      'inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all',
      className
    )}
  >
    {children}
  </button>
);

const IconButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  'aria-label'?: string;
}> = ({ children, onClick, disabled, className, title, 'aria-label': ariaLabel }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={ariaLabel}
    className={clsx(
      'inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
      className
    )}
  >
    {children}
  </button>
);

interface AdminHeaderProps {
  isEditing: boolean;
  isLoading: boolean;
  hasLocalChanges: boolean;
  undoStackLength: number;
  onEditToggle: () => void;
  onSave: () => void;
  onUndo: () => void;
  onQuickImport: (e?: React.MouseEvent) => void;
  onImport: (e?: React.MouseEvent) => void;
  onRestoreVersion: () => void;
  onDownload: () => void;
  onBack?: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  isEditing,
  isLoading,
  hasLocalChanges,
  undoStackLength,
  onEditToggle,
  onSave,
  onUndo,
  onQuickImport,
  onImport,
  onRestoreVersion,
  onDownload,
  onBack,
}) => {
  const router = useRouter();

  // Evitar recriar funções inline em render
  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  }, [onBack, router]);

  const handleSave = useCallback(() => {
    onSave();
  }, [onSave]);

  const handleEditToggle = useCallback(() => {
    onEditToggle();
  }, [onEditToggle]);

  const handleUndo = useCallback(() => {
    onUndo();
  }, [onUndo]);

  const handleQuickImport = useCallback((e?: React.MouseEvent) => {
    onQuickImport(e);
  }, [onQuickImport]);

  const handleImport = useCallback((e?: React.MouseEvent) => {
    onImport(e);
  }, [onImport]);

  const handleRestoreVersion = useCallback(() => {
    onRestoreVersion();
  }, [onRestoreVersion]);

  const handleDownload = useCallback(() => {
    onDownload();
  }, [onDownload]);

  return (
    <>
      {/* Header - Desktop Only */}
      <header className="hidden lg:block sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">Editor: bbb26.json</h1>
              <span className="hidden xl:inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                Semana atual
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Chips de status menores */}
              {isEditing && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full mr-1.5 animate-pulse"></span>
                  Editando
                </span>
              )}

              {hasLocalChanges && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5"></span>
                  Alterações
                </span>
              )}

              {/* Botão primário: Salvar */}
              <ActionButton
                onClick={handleSave}
                disabled={isLoading || !hasLocalChanges}
                className={clsx(
                  hasLocalChanges
                    ? 'border-transparent text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 ring-2 ring-indigo-300 shadow-lg'
                    : 'border-transparent text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                )}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <DocumentCheckIcon className="h-4 w-4 mr-2" />
                    Salvar
                  </>
                )}
              </ActionButton>

              {/* Botões secundários */}
              <div className="flex items-center gap-2">
                <IconButton
                  onClick={handleEditToggle}
                  className={clsx(
                    isEditing
                      ? 'border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:ring-indigo-500'
                      : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50 focus:ring-gray-500'
                  )}
                >
                  {isEditing ? (
                    <>
                      <EyeIcon className="h-4 w-4 mr-2" />
                      Visualizar
                    </>
                  ) : (
                    <>
                      <PencilIcon className="h-4 w-4 mr-2" />
                      Editar
                    </>
                  )}
                </IconButton>

                <IconButton
                  onClick={handleUndo}
                  disabled={!isEditing || undoStackLength === 0}
                  className="border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 focus:ring-red-500"
                  title={
                    !isEditing
                      ? 'Entre no modo edição para desfazer alterações'
                      : undoStackLength === 0
                      ? 'Nenhuma ação para desfazer'
                      : `Desfazer última alteração (${undoStackLength} disponível(is))`
                  }
                >
                  ↶ Desfazer {undoStackLength > 0 && `(${undoStackLength})`}
                </IconButton>

                <div className="w-px h-6 bg-gray-300"></div>

                <IconButton
                  onClick={handleQuickImport}
                  disabled={isLoading}
                  className="border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 focus:ring-blue-500"
                  title="Importar automaticamente o arquivo bbb26.json da raiz do projeto (mantenha Shift para modo LENIENT)"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 mr-2"></div>
                      Importando...
                    </>
                  ) : (
                    <>
                      <DocumentCheckIcon className="h-4 w-4 mr-2" />
                      ⚡ bbb26.json
                    </>
                  )}
                </IconButton>

                <IconButton
                  onClick={handleImport}
                  disabled={isLoading}
                  className="border-gray-200 text-gray-700 bg-white hover:bg-gray-50 focus:ring-gray-500"
                  title="Importar arquivo JSON (procure por bbb26.json na raiz do projeto)"
                >
                  <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                  Importar
                </IconButton>

                <div className="w-px h-6 bg-gray-300"></div>

                <IconButton
                  onClick={handleRestoreVersion}
                  disabled={isLoading}
                  className="border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 focus:ring-orange-500"
                >
                  <BackspaceIcon className="h-4 w-4 mr-2" />
                  Restaurar
                </IconButton>

                <IconButton
                  onClick={handleDownload}
                  disabled={isLoading}
                  className="border-transparent text-white bg-green-600 hover:bg-green-700 focus:ring-green-500"
                >
                  <CloudArrowDownIcon className="h-4 w-4 mr-2" />
                  Baixar
                </IconButton>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Header - Mobile Only */}
      <header className="lg:hidden bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                type="button"
                onClick={handleBack}
                className="mr-4 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                aria-label="Voltar"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <h1 className="text-sm font-semibold text-gray-900">bbb26.json</h1>
            </div>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={handleImport}
                disabled={isLoading}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Importar JSON"
                aria-label="Importar arquivo JSON"
              >
                <CloudArrowUpIcon className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isLoading || !hasLocalChanges}
                className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Salvar"
                aria-label="Salvar alterações"
              >
                <DocumentCheckIcon className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={handleDownload}
                disabled={isLoading}
                className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Baixar JSON"
                aria-label="Baixar arquivo JSON"
              >
                <CloudArrowDownIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>
    </>
  );
};