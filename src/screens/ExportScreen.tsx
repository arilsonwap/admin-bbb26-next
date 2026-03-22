'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, CloudArrowDownIcon, DocumentTextIcon, ClipboardIcon, ExclamationTriangleIcon, ArchiveBoxIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useAdminStore } from '../store/adminStore';
import { exportAllFiles, formatFileSize, downloadFile, copyToClipboard, exportAllFilesAsZip, exportFlexible, ExportOptions } from '../services/exportService';
import { JsonViewer } from '../components/common/JsonViewer';
import { Card } from '../components/common/Card';
import { Dropdown } from '../components/common/Dropdown';
import { loadLastExportTimestamp, saveLastExportTimestamp } from '../services/storageService';

type ExportTab = 'bbb26' | 'participants' | 'paredao';
type ExportFormat = 'zip' | 'individual' | 'copy';

export const ExportScreen: React.FC = () => {
  const router = useRouter();
  const { database, errors } = useAdminStore();
  const [activeTab, setActiveTab] = useState<ExportTab>('bbb26');
  const [isExporting, setIsExporting] = useState(false);
  const [lastExportTime, setLastExportTime] = useState<Date | null>(null);

  // Estados para export profissional
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeBbb26: true,
    includeParticipants: true,
    includeParedao: true,
    format: 'zip',
    includeReadme: true,
  });

  // Carregar timestamp da última exportação
  React.useEffect(() => {
    const loadTimestamp = async () => {
      const timestamp = await loadLastExportTimestamp();
      setLastExportTime(timestamp);
    };
    loadTimestamp();
  }, []);

  const exportData = useMemo(() => {
    if (!database) return null;
    try {
      return exportAllFiles(database);
    } catch (error) {
      console.error('Erro ao exportar dados:', error);
      return null;
    }
  }, [database]);

  const hasCriticalErrors = errors.some(error => error.type === 'ERROR');

  const getCurrentTabData = () => {
    if (!exportData) return null;

    switch (activeTab) {
      case 'bbb26':
        return exportData.bbb26;
      case 'participants':
        return exportData.participantsStatus;
      case 'paredao':
        return exportData.paredaoResults;
      default:
        return null;
    }
  };

  const getTabTitle = (tab: ExportTab) => {
    switch (tab) {
      case 'bbb26':
        return 'bbb26.json';
      case 'participants':
        return 'participants-status.json';
      case 'paredao':
        return 'paredao-results.json';
    }
  };

  const getTabSize = (tab: ExportTab) => {
    if (!exportData) return '0 B';

    const data = getCurrentTabData();
    if (!data) return '0 B';

    const jsonString = JSON.stringify(data);
    return formatFileSize(new Blob([jsonString]).size);
  };

  const handleExportFile = async (filename: string, data: any) => {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      downloadFile(filename, jsonString);
      alert(`${filename} foi baixado com sucesso!`);
    } catch (error) {
      console.error('Erro ao exportar arquivo:', error);
      alert('Erro ao exportar arquivo');
    }
  };

  const handleExportAll = async () => {
    if (!exportData) {
      alert('Dados não disponíveis para exportação');
      return;
    }

    setIsExporting(true);
    try {
      // Exportar todos os arquivos
      await handleExportFile('bbb26.json', exportData.bbb26);
      setTimeout(() => handleExportFile('participants-status.json', exportData.participantsStatus), 500);
      setTimeout(() => handleExportFile('paredao-results.json', exportData.paredaoResults), 1000);

      // Salvar timestamp
      await saveLastExportTimestamp();
      const now = new Date();
      setLastExportTime(now);

      setTimeout(() => {
        alert('Todos os arquivos foram exportados com sucesso!');
      }, 1500);

    } catch (error) {
      console.error('Erro na exportação completa:', error);
      alert('Erro na exportação completa');
    } finally {
      setTimeout(() => setIsExporting(false), 1500);
    }
  };

  const handleCopyToClipboard = async () => {
    const data = getCurrentTabData();
    if (!data) return;

    const success = await copyToClipboard(JSON.stringify(data, null, 2));
    if (success) {
      alert('Conteúdo copiado para a área de transferência!');
    } else {
      alert('Erro ao copiar para a área de transferência');
    }
  };

  // Funções de export profissional
  const handleProfessionalExport = async () => {
    if (!database) {
      alert('Dados não disponíveis para exportação');
      return;
    }

    setIsExporting(true);
    try {
      await exportFlexible(database, exportOptions);

      // Salvar timestamp se foi um download real
      if (exportOptions.format !== 'copy') {
        await saveLastExportTimestamp();
        setLastExportTime(new Date());
      }

      const formatName = {
        zip: 'arquivo ZIP',
        individual: 'arquivos individuais',
        copy: 'área de transferência'
      }[exportOptions.format];

      alert(`Export realizado com sucesso como ${formatName}!`);
    } catch (error) {
      console.error('Erro no export profissional:', error);
      alert('Erro no export profissional');
    } finally {
      setIsExporting(false);
    }
  };

  const handleQuickZipExport = async () => {
    if (!database) {
      alert('Dados não disponíveis para exportação');
      return;
    }

    setIsExporting(true);
    try {
      await exportAllFilesAsZip(database);
      await saveLastExportTimestamp();
      setLastExportTime(new Date());
      alert('Pacote ZIP exportado com sucesso!');
    } catch (error) {
      console.error('Erro no export ZIP:', error);
      alert('Erro no export ZIP');
    } finally {
      setIsExporting(false);
    }
  };

  if (!database || !exportData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  const currentData = getCurrentTabData();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Desktop Only */}
      <header className="hidden lg:block bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">Exportar Dados</h1>
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
              <h1 className="text-xl font-semibold text-gray-900">Exportar Dados</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Export Profissional */}
      <div className="py-4 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center mb-4">
            <ArchiveBoxIcon className="h-6 w-6 text-indigo-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">Export Profissional</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Seleção de arquivos */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Arquivos a incluir:</h3>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeBbb26}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeBbb26: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">bbb26.json (configurações da semana)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeParticipants}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeParticipants: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">participants-status.json (lista de participantes)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeParedao}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeParedao: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">paredao-results.json (histórico de paredões)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeReadme}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeReadme: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">README.txt (instruções de uso)</span>
                </label>
              </div>
            </div>

            {/* Opções de formato */}
            <div>
              <div className="mb-4">
                <Dropdown
                  label="Formato de export:"
                  options={[
                    { label: '📦 Arquivo ZIP (recomendado)', value: 'zip' },
                    { label: '📄 Arquivos individuais', value: 'individual' },
                    { label: '📋 Copiar para área de transferência', value: 'copy' },
                  ]}
                  value={exportOptions.format}
                  onValueChange={(value) => setExportOptions(prev => ({ ...prev, format: value as ExportFormat }))}
                />
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleProfessionalExport}
                  disabled={isExporting || !exportOptions.includeBbb26 && !exportOptions.includeParticipants && !exportOptions.includeParedao}
                  className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-3"></div>
                      Exportando...
                    </>
                  ) : (
                    <>
                      <ArchiveBoxIcon className="h-5 w-5 mr-3" />
                      Exportar Selecionados
                    </>
                  )}
                </button>

                <button
                  onClick={handleQuickZipExport}
                  disabled={isExporting}
                  className="w-full flex items-center justify-center px-4 py-3 border border-indigo-300 text-base font-medium rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArchiveBoxIcon className="h-5 w-5 mr-3" />
                  Export Rápido (ZIP Completo)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            variant={hasCriticalErrors ? 'error' : 'primary'}
            className="p-4"
          >
            <div className="flex items-center">
              <div className={`p-2 rounded-full ${hasCriticalErrors ? 'bg-red-100' : 'bg-green-100'} mr-3`}>
                {hasCriticalErrors ? (
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                ) : (
                  <DocumentTextIcon className="h-5 w-5 text-green-600" />
                )}
              </div>
              <div>
                <p className={`font-medium ${hasCriticalErrors ? 'text-red-800' : 'text-green-800'}`}>
                  {hasCriticalErrors
                    ? 'Corrija os erros antes de exportar'
                    : 'Dados validados e prontos para exportação'
                  }
                </p>
              </div>
            </div>
          </Card>

          {lastExportTime && (
            <Card variant="secondary" className="p-4">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-blue-100 mr-3">
                  <CloudArrowDownIcon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Última exportação</p>
                  <p className="font-medium text-gray-900">
                    {lastExportTime.toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Abas */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {(['bbb26', 'participants', 'paredao'] as ExportTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {getTabTitle(tab)} <span className="text-xs text-gray-400">({getTabSize(tab)})</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Preview */}
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <JsonViewer
          data={currentData}
          title={`Preview: ${getTabTitle(activeTab)}`}
          maxHeight={400}
          collapsible={false}
        />
      </div>

      {/* Ações */}
      <div className="max-w-7xl mx-auto pb-8 px-4 sm:px-6 lg:px-8">
        {/* Botão principal */}
        <div className="mb-6">
          <button
            onClick={handleExportAll}
            disabled={hasCriticalErrors || isExporting}
            className={`w-full flex items-center justify-center px-6 py-4 border border-transparent text-base font-medium rounded-lg text-white ${
              hasCriticalErrors || isExporting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
            } transition-colors`}
          >
            <CloudArrowDownIcon className="h-6 w-6 mr-3" />
            {isExporting ? 'Exportando Arquivos...' : '📤 Exportar Todos os Arquivos'}
          </button>

          {hasCriticalErrors && (
            <p className="mt-2 text-sm text-red-600 text-center">
              ⚠️ Corrija os erros críticos antes de exportar
            </p>
          )}
        </div>

        {/* Ações específicas */}
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Ações para {getTabTitle(activeTab)}:
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleCopyToClipboard}
              className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              <ClipboardIcon className="h-5 w-5 mr-2" />
              Copiar JSON
            </button>

            <button
              onClick={() => handleExportFile(getTabTitle(activeTab), currentData)}
              className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              <CloudArrowDownIcon className="h-5 w-5 mr-2" />
              Baixar Arquivo
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};