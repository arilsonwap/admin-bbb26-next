'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ArrowLeftIcon,
  CloudArrowUpIcon,
  CloudArrowDownIcon,
  DocumentCheckIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  BackspaceIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '../store/adminStore';
import { Card } from '../components/common/Card';
import { StatusChip } from '../components/common/Chip';
import ModalConfirm from '../components/ui/ModalConfirm';
import { exportToParticipantsStatus, importDatabase, downloadFile, formatJSON } from '../services/exportService';
import { saveAdminDatabase } from '../services/storageService';
import { useParticipantValidation } from '../hooks/useParticipantValidation';
import { useVersioning } from '../hooks/useVersioning';

type StatusFilter = 'TODOS' | 'ATIVO' | 'ELIMINADO' | 'DESCLASSIFICADO';

type LoadingAction = null | 'import' | 'restore' | 'save' | 'download' | 'eliminate' | 'other';

// Função para normalizar texto (remover acentos, converter para lowercase)
const normalizeText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
};

export const ParticipantsStatusEditor: React.FC = () => {
  const router = useRouter();
  const { database, updateDatabase, setDatabase } = useAdminStore();
  const { findParticipantUsage, clearParticipantFromAllLocations } = useParticipantValidation();
  const { saveVersion, getVersionsByType, restoreVersion } = useVersioning();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('TODOS');
  const [isLoading, setIsLoading] = useState(false);

  // Estados dos modais
  const [eliminationModal, setEliminationModal] = useState<{
    isOpen: boolean;
    participantId: string;
    participantName: string;
    usageDetails: string[];
    autoRemove: boolean;
  } | null>(null);

  const [restoreModal, setRestoreModal] = useState<{
    isOpen: boolean;
    versions: Array<{ id: string; description: string; timestamp: Date }>;
    selectedVersionId: string | null;
  } | null>(null);

  // Modal de confirmação de import
  const [importConfirmModal, setImportConfirmModal] = useState<{
    isOpen: boolean;
    importedCount: number;
    onConfirm: () => void;
  } | null>(null);

  // Estado para loading específico por ação
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);

  // Classes utilitárias para botões
  const btnBase =
    "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const btnSecondary =
    `${btnBase} border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-gray-500`;

  const btnPrimary =
    `${btnBase} border border-transparent text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500`;

  const btnSuccess =
    `${btnBase} border border-transparent text-white bg-green-600 hover:bg-green-700 focus:ring-green-500`;

  const btnWarn =
    `${btnBase} border border-orange-200 text-orange-800 bg-orange-50 hover:bg-orange-100 focus:ring-orange-500`;

  // Paginação
  const ITEMS_PER_PAGE = 50;
  const [currentPage, setCurrentPage] = useState(1);

  // Converte o estado atual para o formato de export
  const currentData = useMemo(() => {
    if (!database) return null;
    return exportToParticipantsStatus(database);
  }, [database]);

  // Lista filtrada de participantes
  const filteredParticipants = useMemo(() => {
    if (!currentData) return [];

    let filtered = Object.entries(currentData.participants).map(([id, data]) => ({
      id,
      status: data.status,
    }));

    // Filtro por status
    if (statusFilter !== 'TODOS') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }


    // Ordena por ID
    return filtered.sort((a, b) => a.id.localeCompare(b.id));
  }, [currentData, statusFilter]);

  // Estatísticas
  const stats = useMemo(() => {
    if (!currentData) return { total: 0, ativo: 0, eliminado: 0, desclassificado: 0 };

    const participants = Object.values(currentData.participants);
    return {
      total: participants.length,
      ativo: participants.filter(p => p.status === 'ATIVO').length,
      eliminado: participants.filter(p => p.status === 'ELIMINADO').length,
      desclassificado: participants.filter(p => p.status === 'DESCLASSIFICADO').length,
    };
  }, [currentData]);

  // Participantes paginados
  const paginatedParticipants = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredParticipants.slice(startIndex, endIndex);
  }, [filteredParticipants, currentPage]);

  const totalPages = Math.ceil(filteredParticipants.length / ITEMS_PER_PAGE);

  // Ajustar página atual se ficar inválida
  useEffect(() => {
    setCurrentPage((p) => Math.min(p, Math.max(1, totalPages)));
  }, [totalPages]);

  // Funções de ação rápida
  const updateParticipantStatus = useCallback(async (participantId: string, newStatus: 'ATIVO' | 'ELIMINADO' | 'DESCLASSIFICADO') => {
    if (!database || isLoading) return;

    // Verificar se o participante existe
    const existingParticipant = database.participants[participantId];
    if (!existingParticipant) {
      alert('Participante não encontrado');
      return;
    }

    // Se está marcando como ELIMINADO, verificar uso
    if (newStatus === 'ELIMINADO') {
      const usage = findParticipantUsage(participantId);

      const hasUsage = usage.currentWeek.highlights.length > 0 ||
                      usage.currentWeek.paredao.length > 0 ||
                      usage.history.paredoes.length > 0;

      if (hasUsage) {
        const usageDetails = [
          ...usage.currentWeek.highlights.map(u => `• Destaque: ${u}`),
          ...usage.currentWeek.paredao.map(u => `• Paredão: ${u}`),
          ...usage.history.paredoes.map(u => `• Histórico: ${u}`),
        ];

        setEliminationModal({
          isOpen: true,
          participantId,
          participantName: existingParticipant.name || participantId,
          usageDetails,
          autoRemove: true, // padrão: remover automaticamente
        });
        return;
      }
    }

    // Atualização direta (sem confirmação adicional)
    updateDatabase((prevDb) => {
      if (!prevDb || !prevDb.participants[participantId]) return prevDb;

      return {
        ...prevDb,
        participants: {
          ...prevDb.participants,
          [participantId]: {
            ...prevDb.participants[participantId],
            status: newStatus,
            updatedAt: new Date().toISOString(),
          }
        }
      };
    });
  }, [database, updateDatabase, findParticipantUsage, isLoading]);

  // Confirmar eliminação via modal
  const confirmElimination = useCallback(async () => {
    if (!eliminationModal) return;

    const { participantId, autoRemove } = eliminationModal;

    setEliminationModal(null);

    try {
      setIsLoading(true);
      setLoadingAction('eliminate');

      updateDatabase((prevDb) => {
        if (!prevDb) return prevDb;

        // Criar uma cópia profunda do database para evitar problemas de referência
        const dbToUpdate = {
          ...prevDb,
          currentWeek: {
            ...prevDb.currentWeek,
            highlights: prevDb.currentWeek.highlights.map(h => ({ ...h })),
            paredao: prevDb.currentWeek.paredao.map(p => ({ ...p })),
          },
          history: {
            ...prevDb.history,
            paredoes: prevDb.history.paredoes.map(p => ({ ...p })),
          },
          participants: { ...prevDb.participants },
        };

        if (autoRemove) {
          // Limpar participante de todos os locais usando o hook
          const cleaned = clearParticipantFromAllLocations(participantId, dbToUpdate);
          if (cleaned) {
            // Aplicar as mudanças da limpeza
            dbToUpdate.currentWeek.highlights = cleaned.currentWeek.highlights;
            dbToUpdate.currentWeek.paredao = cleaned.currentWeek.paredao;
          }
        }

        // Verificar se o participante ainda existe após a limpeza
        const participant = dbToUpdate.participants[participantId];
        if (!participant) return dbToUpdate;

        // Atualizar o status do participante
        dbToUpdate.participants[participantId] = {
          ...participant,
          status: 'ELIMINADO',
          updatedAt: new Date().toISOString(),
        };

        return dbToUpdate;
      });
    } catch (error) {
      console.error('Erro ao eliminar participante:', error);
      alert('Erro ao eliminar participante');
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  }, [eliminationModal, updateDatabase, clearParticipantFromAllLocations]);

  // Importar do arquivo
  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        setIsLoading(true);
        setLoadingAction('import');
        const importedData = await importDatabase(file);

        // Validar e importar participants
        const importedParticipants = importedData.participants;
        if (!importedParticipants || typeof importedParticipants !== 'object') {
          alert('Arquivo não contém dados válidos de participantes');
          return;
        }

        // Validar e criar mapa de updates
        const allowedStatuses = new Set(['ATIVO', 'ELIMINADO', 'DESCLASSIFICADO'] as const);

        function isValidStatus(x: any): x is 'ATIVO'|'ELIMINADO'|'DESCLASSIFICADO' {
          return allowedStatuses.has(x);
        }

        // 1) Monta um mapa "updates" só com { [id]: status }
        const updates: Record<string, 'ATIVO'|'ELIMINADO'|'DESCLASSIFICADO'> = {};
        let importedCount = 0;

        for (const [id, pdata] of Object.entries(importedParticipants)) {
          const status = (pdata as any)?.status;
          if (!isValidStatus(status)) continue;
          updates[id] = status;
          importedCount++;
        }

        if (importedCount === 0) {
          alert('Nenhum status válido encontrado para importar');
          return;
        }

        // 2) Mostrar modal de confirmação
        setImportConfirmModal({
          isOpen: true,
          importedCount,
          onConfirm: () => {
            setIsLoading(true);
            setLoadingAction('import');

            try {
              // Aplicar merge em cima do estado mais recente
              let appliedCount = 0;
              updateDatabase((prevDb) => {
                if (!prevDb) return prevDb;

                const merged = { ...prevDb.participants };
                for (const [id, status] of Object.entries(updates)) {
                  if (!merged[id]) continue; // só participantes existentes
                  merged[id] = {
                    ...merged[id],
                    status,
                    updatedAt: new Date().toISOString(),
                  };
                  appliedCount++;
                }

                return { ...prevDb, participants: merged };
              });

              alert(`${appliedCount} status de participantes importados com sucesso!`);
            } finally {
              setIsLoading(false);
              setLoadingAction(null);
            }
          },
        });
      } catch (error) {
        alert(`Erro ao importar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      } finally {
        setIsLoading(false);
        setLoadingAction(null);
      }
    };

    input.click();
  };

  // Salvar/Gerar arquivo
  const handleSave = async () => {
    if (!database) return;

    try {
      setIsLoading(true);
      setLoadingAction('save');

      // Salvar dados atuais no localStorage
      await saveAdminDatabase(database);

      // Salvar arquivo JSON físico
      const participantsData = exportToParticipantsStatus(database);
      const response = await fetch('/api/save-participants-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: participantsData }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar arquivo JSON');
      }

      // Criar nova versão
      await saveVersion(database, 'Status dos participantes atualizado', 'participants-status');

      alert('Status dos participantes salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert(`Erro ao salvar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  // Restaurar versão anterior
  const handleRestoreVersion = async () => {
    if (isLoading) return;

    const versions = [...getVersionsByType('participants-status')]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (versions.length === 0) {
      alert('Nenhuma versão anterior encontrada');
      return;
    }

    setRestoreModal({
      isOpen: true,
      versions,
      selectedVersionId: versions[0]?.id || null,
    });
  };

  // Confirmar restauração via modal
  const confirmRestore = useCallback(async () => {
    if (!restoreModal?.selectedVersionId) return;

    const selectedVersion = restoreModal.versions.find(v => v.id === restoreModal.selectedVersionId);
    if (!selectedVersion) return;

    setRestoreModal(null);

    try {
      setIsLoading(true);
      setLoadingAction('restore');
      const restoredData = await restoreVersion(selectedVersion.id);
      setDatabase(restoredData);
      alert('Versão restaurada com sucesso!');
    } catch (error) {
      alert('Erro ao restaurar versão');
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  }, [restoreModal, restoreVersion, setDatabase]);

  // Baixar JSON
  const handleDownload = async () => {
    if (!currentData || isLoading) return;

    try {
      setIsLoading(true);
      setLoadingAction('download');

      const filename = `participants-status-${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(filename, formatJSON(currentData));
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  if (!database || !currentData) {
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
      <header className="hidden lg:block sticky top-0 z-30 bg-white/80 backdrop-blur shadow-sm border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-gray-900">
                Editor: <span className="font-mono text-gray-700">participants-status.json</span>
              </h1>

              {/* Badge de loading */}
              {isLoading && (
                <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 border border-indigo-100">
                  <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                  Processando...
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleImport}
                disabled={isLoading}
                className={btnSecondary}
              >
                <CloudArrowUpIcon className="h-4 w-4" />
                Importar
              </button>

              <button
                onClick={handleRestoreVersion}
                disabled={isLoading}
                className={btnWarn}
              >
                <BackspaceIcon className="h-4 w-4" />
                Restaurar
              </button>

              <button
                onClick={handleSave}
                disabled={isLoading}
                className={btnPrimary}
              >
                {loadingAction === 'save' ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin" />
                ) : (
                  <DocumentCheckIcon className="h-4 w-4" />
                )}
                Salvar
              </button>

              <button
                onClick={handleDownload}
                disabled={isLoading}
                className={btnSuccess}
              >
                {loadingAction === 'download' ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin" />
                ) : (
                  <CloudArrowDownIcon className="h-4 w-4" />
                )}
                Baixar JSON
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Header - Mobile Only */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/80 backdrop-blur shadow-sm border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="mr-4 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <h1 className="text-sm font-semibold text-gray-900">participants-status.json</h1>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={handleImport}
                disabled={isLoading}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                title="Importar JSON"
              >
                <CloudArrowUpIcon className="h-5 w-5" />
              </button>

              <button
                onClick={handleSave}
                disabled={isLoading}
                className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 rounded-md transition-colors"
                title="Salvar"
              >
                <DocumentCheckIcon className="h-5 w-5" />
              </button>

              <button
                onClick={handleDownload}
                disabled={isLoading}
                className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-md transition-colors"
                title="Baixar JSON"
              >
                <CloudArrowDownIcon className="h-5 w-5" />
              </button>

              <button
                onClick={handleRestoreVersion}
                disabled={isLoading}
                className="p-2 text-orange-700 hover:text-orange-900 hover:bg-orange-100 rounded-md transition-colors disabled:opacity-50"
                title="Restaurar Versão"
              >
                <BackspaceIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-6 pb-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Estatísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Total</div>
                  <div className="text-2xl font-semibold text-gray-900">{stats.total}</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center">
                  <DocumentCheckIcon className="h-5 w-5 text-gray-600" />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Ativos</div>
                  <div className="text-2xl font-semibold text-green-600">{stats.ativo}</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Eliminados</div>
                  <div className="text-2xl font-semibold text-red-600">{stats.eliminado}</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <XCircleIcon className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Desclassificados</div>
                  <div className="text-2xl font-semibold text-yellow-600">{stats.desclassificado}</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-yellow-50 flex items-center justify-center">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
                </div>
              </div>
            </Card>
          </div>

          {/* Filtros por Status */}
          <Card className="p-4">
            <div className="space-y-3">
              {/* Chips de filtro por status */}
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const chipCounts = {
                    TODOS: stats.total,
                    ATIVO: stats.ativo,
                    ELIMINADO: stats.eliminado,
                    DESCLASSIFICADO: stats.desclassificado,
                  } as const;

                  return ([
                    { label: 'Todos', value: 'TODOS' },
                    { label: 'Ativos', value: 'ATIVO' },
                    { label: 'Eliminados', value: 'ELIMINADO' },
                    { label: 'Desclass.', value: 'DESCLASSIFICADO' },
                  ] as const).map(opt => {
                    const active = statusFilter === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => { setStatusFilter(opt.value); setCurrentPage(1); }}
                        className={[
                          "px-3 py-1.5 rounded-full text-sm border transition-colors",
                          active
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        <span className="flex items-center gap-2">
                          {opt.label}
                          <span className={[
                            "text-xs px-2 py-0.5 rounded-full",
                            active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"
                          ].join(" ")}>
                            {chipCounts[opt.value]}
                          </span>
                        </span>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          </Card>

          {/* Lista de Participantes */}
          <div className="space-y-3">
            {filteredParticipants.length === 0 ? (
              <Card className="text-center py-10">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
                  {statusFilter !== 'TODOS' ? (
                    <ExclamationTriangleIcon className="h-6 w-6 text-gray-500" />
                  ) : (
                    <DocumentCheckIcon className="h-6 w-6 text-gray-500" />
                  )}
                </div>
                <div className="mt-3 text-gray-700 font-medium">
                  {statusFilter !== 'TODOS'
                    ? 'Nenhum participante encontrado'
                    : 'Nenhum participante cadastrado'}
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  {statusFilter !== 'TODOS'
                    ? 'Tente ajustar o filtro de status.'
                    : 'Importe um JSON para começar.'}
                </div>
              </Card>
            ) : (
              paginatedParticipants.map((participant, index) => (
                <Card key={participant.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 font-mono truncate">
                            {participant.id}
                          </span>

                          {/* micro badge */}
                          <span className="hidden sm:inline-flex text-[11px] px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-600">
                            participante
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          ID do participante
                        </div>
                      </div>

                      <div className="shrink-0">
                        <StatusChip status={participant.status} />
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      {participant.status !== 'ATIVO' && (
                        <button
                          onClick={() => updateParticipantStatus(participant.id, 'ATIVO')}
                          disabled={isLoading}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                          title="Marcar como ATIVO"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          <span className="sm:hidden">Ativo</span>
                          <span className="hidden sm:inline">Marcar Ativo</span>
                        </button>
                      )}

                      {participant.status !== 'ELIMINADO' && (
                        <button
                          onClick={() => updateParticipantStatus(participant.id, 'ELIMINADO')}
                          disabled={isLoading}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          title="Marcar como ELIMINADO"
                        >
                          <XCircleIcon className="h-4 w-4" />
                          <span className="sm:hidden">Eliminado</span>
                          <span className="hidden sm:inline">Marcar Eliminado</span>
                        </button>
                      )}

                      {participant.status !== 'DESCLASSIFICADO' && (
                        <button
                          onClick={() => updateParticipantStatus(participant.id, 'DESCLASSIFICADO')}
                          disabled={isLoading}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-yellow-200 bg-yellow-50 text-yellow-800 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                          title="Marcar como DESCLASSIFICADO"
                        >
                          <ExclamationTriangleIcon className="h-4 w-4" />
                          <span className="sm:hidden">Desc.</span>
                          <span className="hidden sm:inline">Marcar Desclassificado</span>
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center text-sm text-gray-700">
                <p>
                  Mostrando <span className="font-medium">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</span> a{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredParticipants.length)}
                  </span> de{' '}
                  <span className="font-medium">{filteredParticipants.length}</span> participantes
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="hidden sm:inline-flex items-center px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Primeira
                </button>

                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>

                <span className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md">
                  Página {currentPage} de {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Próxima
                </button>

                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="hidden sm:inline-flex items-center px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Última
                </button>
              </div>
            </div>
          )}

          {/* Meta informações */}
          <Card className="bg-white border border-gray-200">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm">
              <div className="text-gray-600">
                Última atualização:{" "}
                <span className="font-medium text-gray-900">
                  {currentData.updatedAt ? new Date(currentData.updatedAt).toLocaleString('pt-BR') : 'Nunca'}
                </span>
              </div>
              <div className="text-gray-600">
                Versão: <span className="font-medium text-gray-900">{currentData.version}</span>
              </div>
            </div>
          </Card>
        </div>
        </div>
      </main>

      {/* Modal de Eliminação */}
      {eliminationModal && (
        <ModalConfirm
          isOpen={eliminationModal.isOpen}
          title={`Eliminar ${eliminationModal.participantName}?`}
          message={
            <div>
              <p className="mb-3">
                Este participante está sendo usado nos seguintes locais:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm bg-gray-50 p-3 rounded">
                {eliminationModal.usageDetails.map((detail, index) => (
                  <li key={index} className="text-gray-700">{detail}</li>
                ))}
              </ul>

              <label className="mt-4 flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={eliminationModal.autoRemove}
                  onChange={(e) =>
                    setEliminationModal((prev) => prev ? { ...prev, autoRemove: e.target.checked } : null)
                  }
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <span className="text-gray-700">
                  Remover automaticamente de todos os locais listados acima
                </span>
              </label>

              {!eliminationModal.autoRemove && (
                <p className="mt-2 text-sm text-amber-600">
                  ⚠️ Você precisará remover manualmente deste participante dos locais listados.
                </p>
              )}
            </div>
          }
          confirmText="Eliminar"
          cancelText="Cancelar"
          confirmButtonColor="red"
          onConfirm={confirmElimination}
          onCancel={() => setEliminationModal(null)}
        />
      )}

      {/* Modal de Confirmação de Import */}
      {importConfirmModal && (
        <ModalConfirm
          isOpen={importConfirmModal.isOpen}
          title="Confirmar Importação"
          message={`Encontrados ${importConfirmModal.importedCount} status válidos no arquivo. Serão aplicados apenas aos participantes que existem no sistema.

Deseja continuar?`}
          confirmText="Importar"
          cancelText="Cancelar"
          confirmButtonColor="blue"
          onConfirm={() => {
            importConfirmModal.onConfirm();
            setImportConfirmModal(null);
          }}
          onCancel={() => setImportConfirmModal(null)}
        />
      )}

      {/* Modal de Restauração */}
      {restoreModal && (
        <ModalConfirm
          isOpen={restoreModal.isOpen}
          title="Restaurar Versão Anterior"
          message={
            <div>
              <p className="mb-3">Selecione a versão para restaurar:</p>
              <div className="max-h-60 overflow-y-auto border rounded-md">
                {restoreModal.versions.map((version) => (
                  <label
                    key={version.id}
                    className="flex items-center p-3 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="version"
                      value={version.id}
                      checked={restoreModal.selectedVersionId === version.id}
                      onChange={(e) => setRestoreModal(prev => prev ? {
                        ...prev,
                        selectedVersionId: e.target.value
                      } : null)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <div className="ml-3 flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {version.description}
                      </div>
                      <div className="text-sm text-gray-500">
                        {version.timestamp.toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <p className="mt-3 text-sm text-red-600 font-medium">
                ⚠️ Todos os dados atuais serão perdidos!
              </p>
            </div>
          }
          confirmText="Restaurar"
          cancelText="Cancelar"
          confirmButtonColor="red"
          onConfirm={confirmRestore}
          onCancel={() => setRestoreModal(null)}
        />
      )}
    </div>
  );
};