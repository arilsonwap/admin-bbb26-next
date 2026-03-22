'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  ArrowLeftIcon,
  CloudArrowDownIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ArchiveBoxIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '../store/adminStore';
import { Card } from '../components/common/Card';
import { exportAllFilesAsZip, exportToBBB26, exportToParticipantsStatus, exportToParedaoResults } from '../services/exportService';
import { useParticipantValidation } from '../hooks/useParticipantValidation';

interface FileStatus {
  name: string;
  filename: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  lastModified?: string;
  recordCount?: number;
}

export const PublishScreen: React.FC = () => {
  const router = useRouter();
  const { database } = useAdminStore();
  const { validateParticipantForCurrentWeek, validateParticipantForHistory } = useParticipantValidation();

  const [isExporting, setIsExporting] = useState(false);

  // Validação de cada arquivo
  const filesStatus = useMemo((): FileStatus[] => {
    if (!database) return [];

    const status: FileStatus[] = [];

    // 1. participants-status.json
    const participantsData = exportToParticipantsStatus(database);
    const participantsErrors: string[] = [];
    const participantsWarnings: string[] = [];

    // Validar se tem participantes
    if (Object.keys(participantsData.participants).length === 0) {
      participantsWarnings.push('Nenhum participante cadastrado');
    }

    status.push({
      name: 'participants-status.json',
      filename: 'participants-status.json',
      isValid: participantsErrors.length === 0,
      errors: participantsErrors,
      warnings: participantsWarnings,
      lastModified: participantsData.updatedAt,
      recordCount: Object.keys(participantsData.participants).length,
    });

    // 2. bbb26.json
    const bbb26Data = exportToBBB26(database);
    const bbb26Errors: string[] = [];
    const bbb26Warnings: string[] = [];

    // Validar participantes na semana atual
    const weekParticipantIds = [
      ...database.currentWeek.highlights.map(h => h.participantId).filter(Boolean),
      ...database.currentWeek.paredao.map(s => s.participantId).filter(Boolean),
    ] as string[];

    const weekValidations = weekParticipantIds.map(id => validateParticipantForCurrentWeek(id));

    weekValidations.forEach((validation, index) => {
      if (!validation.isValid) {
        const participantId = weekParticipantIds[index];
        const participantName = validation.exists ? database.participants[participantId]?.name || participantId : participantId;
        bbb26Errors.push(...validation.errors.map(err => `${participantName}: ${err}`));
      }
    });

    // Validações específicas da semana
    if (database.currentWeek.votingStatus === 'OPEN' && database.currentWeek.paredaoState === 'NOT_FORMED') {
      bbb26Errors.push('Não é possível ter votação aberta se o paredão não foi formado');
    }

    const filledSlots = database.currentWeek.paredao.filter(slot => slot.participantId).length;
    if (database.currentWeek.paredaoState === 'FORMED' && filledSlots < 2) {
      bbb26Errors.push('Paredão formado deve ter pelo menos 2 participantes');
    }

    status.push({
      name: 'bbb26.json',
      filename: 'bbb26.json',
      isValid: bbb26Errors.length === 0,
      errors: bbb26Errors,
      warnings: bbb26Warnings,
      lastModified: bbb26Data.updatedAt,
      recordCount: database.currentWeek.highlights.length + database.currentWeek.paredao.length,
    });

    // 3. paredao-results.json
    const paredaoData = exportToParedaoResults(database);
    const paredaoErrors: string[] = [];
    const paredaoWarnings: string[] = [];

    // Validar cada paredão
    paredaoData.paredoes.forEach((paredao, index) => {
      const eliminatedCount = paredao.resultados.filter(r => r.status === 'ELIMINADO').length;
      if (eliminatedCount !== 1) {
        paredaoErrors.push(`Paredão ${index + 1}: deve ter exatamente 1 eliminado (tem ${eliminatedCount})`);
      }

      // Verificar participantes únicos
      const participantIds = paredao.resultados.map(r => r.id);
      const uniqueIds = new Set(participantIds);
      if (uniqueIds.size !== participantIds.length) {
        paredaoErrors.push(`Paredão ${index + 1}: participantes devem ser únicos`);
      }

      // Verificar participantes não cadastrados (aviso, não erro)
      paredao.resultados.forEach(result => {
        const validation = validateParticipantForHistory(result.id);
        if (!validation.exists) {
          paredaoWarnings.push(`Paredão ${index + 1}: ${result.id} não está cadastrado`);
        }
      });
    });

    status.push({
      name: 'paredao-results.json',
      filename: 'paredao-results.json',
      isValid: paredaoErrors.length === 0,
      errors: paredaoErrors,
      warnings: paredaoWarnings,
      recordCount: paredaoData.paredoes.length,
    });

    return status;
  }, [database, validateParticipantForCurrentWeek, validateParticipantForHistory]);

  // Status geral
  const overallStatus = useMemo(() => {
    const hasErrors = filesStatus.some(file => !file.isValid);
    const hasWarnings = filesStatus.some(file => file.warnings.length > 0);

    if (hasErrors) return 'error';
    if (hasWarnings) return 'warning';
    return 'success';
  }, [filesStatus]);

  // Função para publicar tudo
  const handlePublishAll = async () => {
    if (!database) return;

    if (overallStatus === 'error') {
      alert('Corrija os erros antes de publicar');
      return;
    }

    setIsExporting(true);
    try {
      await exportAllFilesAsZip(database);
      alert('Todos os arquivos publicados com sucesso!');
    } catch (error) {
      alert('Erro ao publicar arquivos');
    } finally {
      setIsExporting(false);
    }
  };

  // Função para ver detalhes de um arquivo
  const handleViewFile = (filename: string) => {
    switch (filename) {
      case 'participants-status.json':
        router.push('/participants-status');
        break;
      case 'bbb26.json':
        router.push('/bbb26');
        break;
      case 'paredao-results.json':
        router.push('/paredao-results');
        break;
    }
  };

  if (!database) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dados...</p>
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
            <h1 className="text-xl font-semibold text-gray-900">Publicar Arquivos</h1>

            <button
              onClick={handlePublishAll}
              disabled={isExporting || overallStatus === 'error'}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Publicando...
                </>
              ) : (
                <>
                  <ArchiveBoxIcon className="h-5 w-5 mr-3" />
                  Publicar Tudo (ZIP)
                </>
              )}
            </button>
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
              <h1 className="text-sm font-semibold text-gray-900">Publicar Arquivos</h1>
            </div>

            <button
              onClick={handlePublishAll}
              disabled={isExporting || overallStatus === 'error'}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? 'Publicando...' : 'Publicar ZIP'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Status Geral */}
          <Card className={`border-l-4 ${
            overallStatus === 'error' ? 'border-l-red-400 bg-red-50' :
            overallStatus === 'warning' ? 'border-l-yellow-400 bg-yellow-50' :
            'border-l-green-400 bg-green-50'
          }`}>
            <div className="flex items-center">
              <div className={`p-2 rounded-full mr-4 ${
                overallStatus === 'error' ? 'bg-red-100' :
                overallStatus === 'warning' ? 'bg-yellow-100' :
                'bg-green-100'
              }`}>
                {overallStatus === 'error' ? (
                  <XCircleIcon className="h-6 w-6 text-red-600" />
                ) : overallStatus === 'warning' ? (
                  <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
                ) : (
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                )}
              </div>
              <div>
                <h3 className={`text-lg font-medium ${
                  overallStatus === 'error' ? 'text-red-800' :
                  overallStatus === 'warning' ? 'text-yellow-800' :
                  'text-green-800'
                }`}>
                  {overallStatus === 'error' ? '❌ Erros encontrados' :
                   overallStatus === 'warning' ? '⚠️ Avisos encontrados' :
                   '✅ Pronto para publicar'}
                </h3>
                <p className={`text-sm mt-1 ${
                  overallStatus === 'error' ? 'text-red-600' :
                  overallStatus === 'warning' ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  {overallStatus === 'error'
                    ? 'Corrija os erros antes de publicar'
                    : overallStatus === 'warning'
                    ? 'Arquivos podem ser publicados, mas revise os avisos'
                    : 'Todos os arquivos estão válidos e prontos para publicação'
                  }
                </p>
              </div>
            </div>
          </Card>

          {/* Status dos Arquivos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {filesStatus.map((file) => (
              <Card key={file.name} className="relative">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <h3 className="text-lg font-medium text-gray-900">{file.name}</h3>
                      {file.isValid ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500 ml-2" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-red-500 ml-2" />
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-gray-600">
                      <div>Registros: {file.recordCount || 0}</div>
                      {file.lastModified && (
                        <div>Modificado: {new Date(file.lastModified).toLocaleString('pt-BR')}</div>
                      )}
                    </div>

                    {/* Erros */}
                    {file.errors.length > 0 && (
                      <div className="mt-3">
                        <div className="text-sm font-medium text-red-800 mb-1">Erros:</div>
                        <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                          {file.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Avisos */}
                    {file.warnings.length > 0 && (
                      <div className="mt-3">
                        <div className="text-sm font-medium text-yellow-800 mb-1">Avisos:</div>
                        <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
                          {file.warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleViewFile(file.filename)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                    title={`Editar ${file.name}`}
                  >
                    <EyeIcon className="h-5 w-5" />
                  </button>
                </div>
              </Card>
            ))}
          </div>

          {/* Instruções */}
          <Card className="bg-blue-50 border-blue-200">
            <div className="flex items-start">
              <DocumentTextIcon className="h-6 w-6 text-blue-600 mr-3 mt-0.5" />
              <div>
                <h3 className="text-lg font-medium text-blue-900 mb-2">Como usar</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>participants-status.json</strong>: Status global de todos os participantes</li>
                  <li>• <strong>bbb26.json</strong>: Estado atual da semana (highlights e paredão)</li>
                  <li>• <strong>paredao-results.json</strong>: Histórico completo de todos os paredões</li>
                  <li>• Clique em "Publicar Tudo" para baixar um ZIP com os 3 arquivos</li>
                  <li>• Use os ícones de olho para editar cada arquivo individualmente</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};