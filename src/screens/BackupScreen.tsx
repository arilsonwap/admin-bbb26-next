'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  CloudArrowDownIcon,
  TrashIcon,
  FolderIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { Card } from '../components/common/Card';
import {
  listBackupsWithPreview,
  listManualBackups,
  downloadBackup,
  exportAllBackups,
  clearAllData,
  getStorageStats,
  restoreFromBackup
} from '../services/storageService';
import { useAdminStore } from '../store/adminStore';
import { useAdminApp } from '../hooks/useAdminApp';

interface BackupItemProps {
  key: string;
  timestamp: Date;
  size: number;
  version: number;
  participantsCount: number;
  paredoesCount: number;
  type: 'auto' | 'manual';
  description?: string;
  onDownload: () => void;
  onRestore: () => void;
  onDelete: () => void;
}

const BackupItem: React.FC<BackupItemProps> = ({
  timestamp,
  size,
  version,
  participantsCount,
  paredoesCount,
  type,
  description,
  onDownload,
  onRestore,
  onDelete,
}) => {
  const formatDate = (date: Date) => {
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              type === 'manual'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {type === 'manual' ? 'Manual' : 'Automático'}
            </div>
            <span className="ml-2 text-sm text-gray-500">
              v{version}
            </span>
          </div>

          <h3 className="text-lg font-medium text-gray-900 mb-1">
            {description || `Backup ${type === 'manual' ? 'Manual' : 'Automático'}`}
          </h3>

          <p className="text-sm text-gray-600 mb-2">
            {formatDate(timestamp)}
          </p>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Tamanho:</span>
              <span className="ml-1 font-medium">{formatSize(size)}</span>
            </div>
            <div>
              <span className="text-gray-500">Participantes:</span>
              <span className="ml-1 font-medium">{participantsCount}</span>
            </div>
            <div>
              <span className="text-gray-500">Paredões:</span>
              <span className="ml-1 font-medium">{paredoesCount}</span>
            </div>
          </div>
        </div>

        <div className="flex space-x-2 ml-4">
          <button
            onClick={onDownload}
            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
            title="Download"
          >
            <CloudArrowDownIcon className="h-5 w-5" />
          </button>

          <button
            onClick={onRestore}
            className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md transition-colors"
            title="Restaurar"
          >
            <CheckCircleIcon className="h-5 w-5" />
          </button>

          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
            title="Excluir"
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const BackupScreen: React.FC = () => {
  const router = useRouter();
  const { database, setDatabase } = useAdminStore();
  const { saveData } = useAdminApp();

  const [autoBackups, setAutoBackups] = useState<any[]>([]);
  const [manualBackups, setManualBackups] = useState<any[]>([]);
  const [storageStats, setStorageStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadBackups = async () => {
    try {
      setIsLoading(true);

      const [autoData, manualData, stats] = await Promise.all([
        listBackupsWithPreview(),
        listManualBackups(),
        getStorageStats(),
      ]);

      setAutoBackups(autoData);
      setManualBackups(manualData);
      setStorageStats(stats);
    } catch (error) {
      console.error('Erro ao carregar backups:', error);
      alert('Erro ao carregar backups');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleDownloadBackup = async (backupKey: string) => {
    try {
      await downloadBackup(backupKey);
    } catch (error) {
      alert('Erro ao fazer download do backup');
    }
  };

  const handleRestoreBackup = async (backupKey: string, type: 'auto' | 'manual') => {
    try {
      const confirmRestore = confirm(
        'ATENÇÃO: Isso irá substituir todos os dados atuais com os dados do backup. Deseja continuar?\n\n' +
        'Recomendação: Faça um backup dos dados atuais primeiro.'
      );

      if (!confirmRestore) return;

      const restoredData = await restoreFromBackup(backupKey);
      setDatabase(restoredData);
      await saveData();

      alert('Backup restaurado com sucesso!');
      router.push('/');
    } catch (error) {
      alert('Erro ao restaurar backup');
    }
  };

  const handleDeleteBackup = async (backupKey: string) => {
    try {
      const confirmDelete = confirm('Tem certeza que deseja excluir este backup?');

      if (!confirmDelete) return;

      localStorage.removeItem(backupKey);
      await loadBackups();

      alert('Backup excluído com sucesso!');
    } catch (error) {
      alert('Erro ao excluir backup');
    }
  };

  const handleExportAllBackups = async () => {
    try {
      if (autoBackups.length === 0 && manualBackups.length === 0) {
        alert('Nenhum backup encontrado para exportar');
        return;
      }

      await exportAllBackups();
      alert('Backups exportados com sucesso!');
    } catch (error) {
      alert('Erro ao exportar backups');
    }
  };

  const handleClearAllData = async () => {
    try {
      const confirmClear = confirm(
        'ATENÇÃO: Isso irá excluir TODOS os dados, incluindo backups. Esta ação não pode ser desfeita!\n\n' +
        'Tem certeza que deseja continuar?'
      );

      if (!confirmClear) return;

      const finalConfirm = confirm(
        'ÚLTIMA CHANCE: Todos os dados serão perdidos permanentemente. Deseja realmente continuar?'
      );

      if (!finalConfirm) return;

      await clearAllData();
      setDatabase(null);

      alert('Todos os dados foram limpos. A aplicação será recarregada.');
      window.location.href = '/';
    } catch (error) {
      alert('Erro ao limpar dados');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando backups...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Desktop Only */}
      <header className="hidden lg:block bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">Gerenciar Backups</h1>
            <div className="flex space-x-3">
              <button
                onClick={handleExportAllBackups}
                disabled={autoBackups.length === 0 && manualBackups.length === 0}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CloudArrowDownIcon className="h-4 w-4 mr-2" />
                Exportar Todos
              </button>

              <button
                onClick={handleClearAllData}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Limpar Tudo
              </button>
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
                onClick={() => router.back()}
                className="mr-4 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <h1 className="text-xl font-semibold text-gray-900">Gerenciar Backups</h1>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleExportAllBackups}
                disabled={autoBackups.length === 0 && manualBackups.length === 0}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CloudArrowDownIcon className="h-4 w-4 mr-2" />
                Exportar Todos
              </button>

              <button
                onClick={handleClearAllData}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Limpar Tudo
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="pb-6">
          {/* Estatísticas de armazenamento */}
          {storageStats && (
            <Card
              title="Estatísticas de Armazenamento"
              subtitle={`Total: ${storageStats.formattedSize} em ${storageStats.totalKeys} itens`}
              icon={<FolderIcon className="h-6 w-6 text-blue-600" />}
              className="mb-6"
            >
              <div className="text-sm text-gray-600">
                <p>Os dados são armazenados localmente no seu navegador usando localStorage.</p>
                <p className="mt-2">
                  💡 <strong>Dica:</strong> Faça backups regulares exportando o database para arquivos JSON.
                </p>
              </div>
            </Card>
          )}

          {/* Backups Manuais */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <ClockIcon className="h-5 w-5 mr-2 text-yellow-600" />
              Backups Manuais ({manualBackups.length})
            </h2>

            {manualBackups.length === 0 ? (
              <Card
                title="Nenhum backup manual"
                subtitle="Crie backups manuais para ter mais controle sobre seus dados"
                icon={<ClockIcon className="h-6 w-6 text-gray-400" />}
                className="text-center"
              >
                <p className="text-gray-600 mt-4">
                  Backups manuais são criados quando você clica em "Criar Backup Manual" no dashboard.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {manualBackups.map((backup) => (
                  <BackupItem
                    key={backup.key}
                    {...backup}
                    type="manual"
                    onDownload={() => handleDownloadBackup(backup.key)}
                    onRestore={() => handleRestoreBackup(backup.key, 'manual')}
                    onDelete={() => handleDeleteBackup(backup.key)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Backups Automáticos */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <CheckCircleIcon className="h-5 w-5 mr-2 text-blue-600" />
              Backups Automáticos ({autoBackups.length})
            </h2>

            {autoBackups.length === 0 ? (
              <Card
                title="Nenhum backup automático"
                subtitle="Os backups automáticos são criados quando você salva dados"
                icon={<CheckCircleIcon className="h-6 w-6 text-gray-400" />}
                className="text-center"
              >
                <p className="text-gray-600 mt-4">
                  Sempre que você salva dados, um backup automático é criado para proteger contra perdas.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {autoBackups.map((backup) => (
                  <BackupItem
                    key={backup.key}
                    {...backup}
                    type="auto"
                    onDownload={() => handleDownloadBackup(backup.key)}
                    onRestore={() => handleRestoreBackup(backup.key, 'auto')}
                    onDelete={() => handleDeleteBackup(backup.key)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Avisos de segurança */}
          <Card
            title="⚠️ Avisos de Segurança"
            subtitle="Informações importantes sobre backups"
            icon={<ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />}
            variant="warning"
          >
            <div className="space-y-2 text-sm text-gray-700">
              <p>• <strong>LocalStorage tem limites:</strong> Navegadores limitam o tamanho do localStorage (tipicamente 5-10MB).</p>
              <p>• <strong>Faça backups regulares:</strong> Use "Baixar Database" para salvar cópias em arquivos JSON.</p>
              <p>• <strong>Limpar dados do navegador:</strong> Pode apagar todos os dados. Sempre mantenha backups externos.</p>
              <p>• <strong>Importação sobrescreve dados:</strong> Restaurar backup substitui todos os dados atuais.</p>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};