'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ArrowLeftIcon,
  CloudArrowUpIcon,
  CloudArrowDownIcon,
  DocumentCheckIcon,
  UserGroupIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XMarkIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { Card } from '../components/common/Card';
import { ParticipantsFollowersUpdate, ParticipantFollowers, FollowerHistoryItem } from '../models/types';
import { useNotifications } from '../hooks/useNotifications';
import { formatJSON } from '../services/exportService';
import { downloadFile } from '../services/exportService';

type ValidationError = {
  field: string;
  message: string;
};

// Função para sanitizar IDs automaticamente
const toKebabCase = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const FollowersUpdateScreen: React.FC = () => {
  const router = useRouter();
  const { toasts, removeToast, showSuccess, showError, showWarning, showInfo } = useNotifications();

  // Estado principal
  const [data, setData] = useState<ParticipantsFollowersUpdate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Estados para edição de participantes
  const [editingParticipant, setEditingParticipant] = useState<string | null>(null);
  const [newParticipant, setNewParticipant] = useState<Partial<ParticipantFollowers>>({
    id: '',
    name: '',
    active: true,
    eliminated: false,
    instagram: '',
    followersStart: 0,
    followersCurrent: 0,
    history: []
  });

  // Estados para modal de adicionar histórico
  const [showAddHistoryModal, setShowAddHistoryModal] = useState(false);
  const [historyParticipantId, setHistoryParticipantId] = useState<string>('');
  const [newHistoryItem, setNewHistoryItem] = useState<FollowerHistoryItem>({
    date: new Date().toISOString().split('T')[0],
    followers: 0
  });
  const [followersInput, setFollowersInput] = useState<string>('');
  const [historyParticipantEliminated, setHistoryParticipantEliminated] = useState<boolean>(false);

  // Carregar dados automaticamente ao abrir a tela
  useEffect(() => {
    loadFollowersData();
  }, []);

  // Função para converter números brasileiros em formato numérico
  const parseBrazilianNumber = (value: string): number => {
    // Remove espaços e converte para lowercase
    const cleanValue = value.toLowerCase().trim();

    // Identifica se é milhão ou mil
    const isMilhao = cleanValue.includes('milh');
    const isMil = cleanValue.includes('mil') && !isMilhao;

    // Remove sufixos e pontos
    let numericPart = cleanValue
      .replace(/[^\d.,]/g, '')
      .replace(',', '.');

    let number = parseFloat(numericPart);

    if (isMilhao) {
      number *= 1000000;
    } else if (isMil) {
      number *= 1000;
    }

    return Math.round(number);
  };

  const loadFollowersData = async () => {
    try {
      setIsLoading(true);

      // Tentar carregar dados existentes
      const response = await fetch('/followers-status.json');
      if (!response.ok) {
        // Se não existir, criar estrutura inicial com participantes do BBB 26
        const initialParticipantsData = {
          "Ana Paula Renault": { followers: "2.3 milhões", instagram: "https://www.instagram.com/anapaularenault/" },
          "Chaiany": { followers: "3.3 mil", instagram: "https://www.instagram.com/chaianydeandrade/" },
          "Juliano Floss": { followers: "4.0 milhões", instagram: "https://www.instagram.com/julianofloss/" },
          "Samira": { followers: "5.2 mil", instagram: "https://www.instagram.com/samira_sagr" },
          "Milena": { followers: "3.5 mil", instagram: "https://www.instagram.com/tiamilenabbb/" },
          "Jonas Sulzbach": { followers: "3.0 milhões", instagram: "https://www.instagram.com/jonassulzbach/" },
          "Alberto Cowboy": { followers: "17.8 mil", instagram: "https://www.instagram.com/albertocowboy/" },
          "Breno": { followers: "3.0 mil", instagram: "https://www.instagram.com/brenocora/" },
          "Jordana": { followers: "32.9 mil", instagram: "https://www.instagram.com/jordanarimorais/" },
          "Gabriela": { followers: "2.3 mil", instagram: "https://www.instagram.com/gabisaporito__/" },
          "Babu Santana": { followers: "4.5 milhões", instagram: "https://www.instagram.com/babusantana/" },
          "Marciele": { followers: "745 mil", instagram: "https://www.instagram.com/marciele.albuquerque" },
          "Solange Couto": { followers: "1.1 milhão", instagram: "https://www.instagram.com/solangecouto" },
          "Leandro Boneco": { followers: "13.5 mil", instagram: "https://www.instagram.com/leandrorochaboneco/" }
        };

        const participants: ParticipantFollowers[] = Object.entries(initialParticipantsData).map(([name, data]) => {
          const id = toKebabCase(name);
          const followersStart = parseBrazilianNumber(data.followers);

          return {
            id,
            name,
            active: true,
            eliminated: false,
            instagram: data.instagram || undefined,
            followersStart,
            followersCurrent: followersStart,
            history: [{
              date: new Date().toISOString().split('T')[0], // Data atual
              followers: followersStart,
              source: "Dados iniciais BBB 26",
              notes: "Valor atual dos seguidores"
            }]
          };
        });

        const initialData: ParticipantsFollowersUpdate = {
          version: 1,
          updatedAt: new Date().toISOString(),
          season: 'BBB 26',
          participants
        };

        setData(initialData);
        return;
      }

      const loadedData = await response.json();

      // Migrar dados antigos para novo formato (apenas uma entrada no histórico)
      let hasMigrated = false;
      const migratedData = {
        ...loadedData,
        participants: loadedData.participants.map((participant: ParticipantFollowers) => {
          if (participant.history.length <= 1) {
            return participant; // Já está no formato correto
          }

          // Se tem múltiplas entradas, manter apenas a mais recente
          hasMigrated = true;
          const sortedHistory = participant.history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const latestEntry = sortedHistory[0];

          return {
            ...participant,
            eliminated: participant.eliminated ?? false, // garantir que o campo exista
            followersCurrent: latestEntry.followers,
            history: [{
              date: latestEntry.date,
              followers: latestEntry.followers,
              source: latestEntry.source || "Migrado automaticamente",
              notes: latestEntry.notes || "Mantido apenas o valor mais recente"
            }]
          };
        })
      };

      setData(migratedData);

      // Notificar sobre migração se ocorreu
      if (hasMigrated) {
        showInfo(
          'Dados migrados',
          'Os dados antigos foram migrados para o novo formato. Cada participante agora mantém apenas o valor mais recente dos seguidores.'
        );
      }
    } catch (error) {
      console.error('Erro ao carregar dados de seguidores:', error);
      showError('Erro ao carregar dados', 'Não foi possível carregar os dados de seguidores.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveFollowersData = async () => {
    if (!data) return;

    try {
      setIsLoading(true);

      // Criar backup automático antes de salvar
      const backupData = structuredClone(data);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilename = `followers-status-backup-${timestamp}.json`;

      try {
        const backupResponse = await fetch('/api/save-followers-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: backupData,
            filename: backupFilename
          }),
        });

        if (backupResponse.ok) {
          console.log(`Backup criado: ${backupFilename}`);
        }
      } catch (backupError) {
        console.warn('Não foi possível criar backup:', backupError);
        // Continua mesmo se backup falhar
      }

      // Preparar dados para salvar - ordenar histórico e atualizar timestamps
      const updatedData = {
        ...data,
        version: data.version + 1,
        updatedAt: new Date().toISOString(),
        participants: data.participants.map(participant => ({
          ...participant,
          eliminated: participant.eliminated ?? false, // garantir que o campo exista
          history: participant.history.sort((a, b) => a.date.localeCompare(b.date))
        }))
      };

      // Salvar via API
      const response = await fetch('/api/save-followers-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: updatedData }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar dados');
      }

      setData(updatedData);
      showSuccess('Dados salvos!', 'Dados de seguidores atualizados com sucesso.');
    } catch (error) {
      console.error('Erro ao salvar dados:', error);
      showError('Erro ao salvar', error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!data) return;

    const filename = `followers-status-${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(filename, formatJSON(data));
  };

  const addParticipant = () => {
    if (!data) return;

    if (!newParticipant.name?.trim()) {
      showError('Dados inválidos', 'Nome é obrigatório.');
      return;
    }

    // Gerar ID automaticamente baseado no nome se não fornecido
    const generatedId = newParticipant.id?.trim() || toKebabCase(newParticipant.name);

    // Verificar se ID já existe
    if (data.participants.find(p => p.id === generatedId)) {
      showError('ID duplicado', `Já existe um participante com o ID "${generatedId}".`);
      return;
    }

    const participant: ParticipantFollowers = {
      id: generatedId,
      name: newParticipant.name.trim(),
      active: newParticipant.active ?? true,
      eliminated: newParticipant.eliminated ?? false,
      instagram: newParticipant.instagram?.trim() || undefined,
      followersStart: newParticipant.followersStart ?? 0,
      followersCurrent: newParticipant.followersCurrent ?? 0,
      history: newParticipant.history ?? []
    };

    setData({
      ...data,
      participants: [...data.participants, participant]
    });

    setNewParticipant({
      id: '',
      name: '',
      active: true,
      eliminated: false,
      instagram: '',
      followersStart: 0,
      followersCurrent: 0,
      history: []
    });

    showSuccess('Participante adicionado!', `Participante "${participant.name}" foi adicionado com sucesso.`);
  };

  const updateParticipant = (participantId: string, updates: Partial<ParticipantFollowers>) => {
    if (!data) return;

    setData({
      ...data,
      participants: data.participants.map(p =>
        p.id === participantId ? { ...p, ...updates } : p
      )
    });
  };

  const removeParticipant = (participantId: string) => {
    if (!data) return;

    setData({
      ...data,
      participants: data.participants.filter(p => p.id !== participantId)
    });
  };

  const addHistoryItem = (participantId: string, historyItem: FollowerHistoryItem) => {
    if (!data) return;

    const participant = data.participants.find(p => p.id === participantId);
    if (!participant) return;

    // Limpar campos vazios para não incluir no JSON
    const cleanHistoryItem: FollowerHistoryItem = {
      date: historyItem.date,
      followers: historyItem.followers,
      ...(historyItem.source?.trim() && { source: historyItem.source.trim() }),
      ...(historyItem.notes?.trim() && { notes: historyItem.notes.trim() })
    };

    // Substituir completamente o histórico com apenas esta entrada
    const updatedHistory = [cleanHistoryItem];

    updateParticipant(participantId, {
      eliminated: historyParticipantEliminated,
      followersCurrent: historyItem.followers,
      history: updatedHistory
    });
  };

  const validateData = (): ValidationError[] => {
    if (!data) return [];

    const errors: ValidationError[] = [];
    const participantIds = new Set<string>();

    data.participants.forEach((participant, index) => {
      // Validar ID único e obrigatório
      if (!participant.id.trim()) {
        errors.push({ field: `participant.${index}.id`, message: 'ID é obrigatório' });
      } else {
        if (participantIds.has(participant.id)) {
          errors.push({ field: `participant.${index}.id`, message: 'ID duplicado - deve ser único' });
        }
        participantIds.add(participant.id);

        // Validar formato do ID (deve ser lowercase, pode ter hífens)
        if (!/^[a-z]+(-[a-z]+)*$/.test(participant.id)) {
          errors.push({ field: `participant.${index}.id`, message: 'ID deve estar em formato kebab-case (ex: ana-paula-renault ou apenas marciele)' });
        }
      }

      // Validar nome obrigatório
      if (!participant.name.trim()) {
        errors.push({ field: `participant.${index}.name`, message: 'Nome é obrigatório' });
      }

      // Validar seguidores
      if (participant.followersStart < 0) {
        errors.push({ field: `participant.${index}.followersStart`, message: 'Seguidores iniciais não podem ser negativos' });
      }

      if (participant.followersCurrent < 0) {
        errors.push({ field: `participant.${index}.followersCurrent`, message: 'Seguidores atuais não podem ser negativos' });
      }

      // Validar histórico
      if (participant.history.length === 0) {
        errors.push({ field: `participant.${index}.history`, message: 'Deve ter exatamente um item no histórico' });
      } else if (participant.history.length > 1) {
        errors.push({ field: `participant.${index}.history`, message: 'Deve ter exatamente um item no histórico (apenas o valor atual)' });
      } else {
        // Verificar se há datas duplicadas
        const dates = new Set<string>();
        participant.history.forEach((item, historyIndex) => {
          if (dates.has(item.date)) {
            errors.push({ field: `participant.${index}.history.${historyIndex}.date`, message: 'Data duplicada no histórico' });
          }
          dates.add(item.date);

          if (item.followers < 0) {
            errors.push({ field: `participant.${index}.history.${historyIndex}.followers`, message: 'Número de seguidores não pode ser negativo' });
          }
        });

        // Verificar se o item do histórico corresponde aos followersCurrent
        const historyItem = participant.history[0];
        if (historyItem && historyItem.followers !== participant.followersCurrent) {
          errors.push({ field: `participant.${index}.followersCurrent`, message: 'Item do histórico deve corresponder aos seguidores atuais' });
        }
      }
    });

    // Validar temporada
    if (!data.season.trim()) {
      errors.push({ field: 'season', message: 'Temporada é obrigatória' });
    }

    return errors;
  };

  const handleSave = async () => {
    const errors = validateData();
    if (errors.length > 0) {
      showError('Erros de validação', `Corrija os seguintes erros:\n\n${errors.map(e => e.message).join('\n')}`);
      return;
    }

    await saveFollowersData();
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR').format(num);
  };

  // Formatar número com identificação de mil/milhão (truncar para baixo)
  const formatFollowersDisplay = (num: number): string => {
    if (num >= 1000000) {
      // Truncar para baixo (sempre arredonda para o menor)
      const millions = Math.floor(num / 100000) / 10; // Divide por 100000, depois por 10
      const formatted = millions.toFixed(1).replace(/\.?0+$/, '');
      return `${formatted} milhões`;
    } else if (num >= 1000) {
      const thousands = Math.floor(num / 100) / 10;
      const formatted = thousands.toFixed(1).replace(/\.?0+$/, '');
      return `${formatted} mil`;
    }
    return num.toString();
  };

  const validationErrors = useMemo(() => validateData(), [data]);

  // Estado para controlar se mostrar erros de validação
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dados de seguidores...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Erro ao carregar dados.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200 backdrop-blur-md bg-white/95">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="mr-4 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <h1 className="text-lg font-semibold text-gray-900">Atualização Manual de Seguidores</h1>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`p-2 rounded-md transition-colors ${
                  isEditing
                    ? 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
                title={isEditing ? 'Modo visualização' : 'Modo edição'}
              >
                {isEditing ? <EyeIcon className="h-5 w-5" /> : <PencilIcon className="h-5 w-5" />}
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
                onClick={handleSave}
                disabled={isLoading || !isEditing}
                className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Salvar"
              >
                <DocumentCheckIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-4 sm:mx-6 lg:mx-8 mt-6">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Erros de validação:</h3>
              <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error.message}</li>
                ))}
              </ul>
              <div className="mt-3">
                <button
                  onClick={() => setShowValidationErrors(!showValidationErrors)}
                  className="text-sm text-red-600 hover:text-red-800 underline"
                >
                  {showValidationErrors ? 'Ocultar detalhes' : 'Mostrar detalhes'}
                </button>
              </div>
              {showValidationErrors && (
                <div className="mt-3 p-3 bg-red-100 rounded text-xs text-red-800">
                  <strong>Campos com erro:</strong>
                  <ul className="mt-1 space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index} className="font-mono">{error.field}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Informações gerais */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <div className="text-sm text-gray-600">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="font-medium">Versão:</span>
                  <div>{data.version}</div>
                </div>
                <div>
                  <span className="font-medium">Temporada:</span>
                  <div>{data.season}</div>
                </div>
                <div>
                  <span className="font-medium">Participantes:</span>
                  <div>{data.participants.length}</div>
                </div>
                <div>
                  <span className="font-medium">Última atualização:</span>
                  <div>{new Date(data.updatedAt).toLocaleString('pt-BR')}</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Lista de participantes */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <UserGroupIcon className="h-6 w-6 text-blue-600 mr-3" />
                <h2 className="text-lg font-semibold text-gray-900">Participantes</h2>
              </div>
              {isEditing && (
                <button
                  onClick={() => setEditingParticipant('new')}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Adicionar Participante
                </button>
              )}
            </div>

            <div className="space-y-4">
              {data.participants.map((participant) => (
                <div key={participant.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <h3 className="text-lg font-medium text-gray-900">{participant.name}</h3>
                      <span className="ml-2 text-sm text-gray-500">({participant.id})</span>
                      {!participant.active && (
                        <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Inativo
                        </span>
                      )}
                      {participant.eliminated && (
                        <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Eliminado
                        </span>
                      )}
                      {participant.instagram && participant.instagram.trim() && (
                        <button
                          onClick={() => window.open(participant.instagram, '_blank')}
                          className="ml-3 inline-flex items-center px-2 py-1 border border-pink-200 text-xs font-medium rounded-md text-pink-700 bg-pink-50 hover:bg-pink-100 transition-colors"
                          title={`Abrir Instagram de ${participant.name}`}
                        >
                          <LinkIcon className="h-3 w-3 mr-1" />
                          Instagram
                        </button>
                      )}
                    </div>

                    {isEditing && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setHistoryParticipantId(participant.id);
                            const currentFollowers = participant.followersCurrent;
                            setNewHistoryItem({
                              date: new Date().toISOString().split('T')[0],
                              followers: currentFollowers
                            });
                            setFollowersInput(currentFollowers.toString());
                            setHistoryParticipantEliminated(participant.eliminated ?? false);
                            setShowAddHistoryModal(true);
                          }}
                          className="inline-flex items-center px-3 py-2 border border-green-200 text-sm font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100"
                        >
                          <PlusIcon className="h-4 w-4 mr-2" />
                          Atualizar Seguidores
                        </button>

                        <button
                          onClick={() => setEditingParticipant(participant.id)}
                          className="inline-flex items-center px-3 py-2 border border-blue-200 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100"
                        >
                          <PencilIcon className="h-4 w-4 mr-2" />
                          Editar
                        </button>

                        <button
                          onClick={() => removeParticipant(participant.id)}
                          className="inline-flex items-center px-3 py-2 border border-red-200 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100"
                        >
                          <TrashIcon className="h-4 w-4 mr-2" />
                          Remover
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Seguidores Iniciais:</span>
                      <div className="text-lg font-semibold text-gray-900">{formatNumber(participant.followersStart)}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Seguidores Atuais:</span>
                      <div className="text-lg font-semibold text-blue-600">{formatNumber(participant.followersCurrent)}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Crescimento:</span>
                      <div className={`text-lg font-semibold ${participant.followersCurrent >= participant.followersStart ? 'text-green-600' : 'text-red-600'}`}>
                        {participant.followersCurrent >= participant.followersStart ? '+' : ''}
                        {formatNumber(participant.followersCurrent - participant.followersStart)}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Atualização:</span>
                      <div className="text-lg font-semibold text-gray-900">{participant.history.length === 1 ? '1 entrada' : `${participant.history.length} entradas`}</div>
                    </div>
                  </div>

                  {/* Valor atual */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Última Atualização:</h4>
                    <div className="space-y-1">
                      {participant.history.map((item, index) => (
                        <div key={index} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                          <span className="font-medium">{new Date(item.date).toLocaleDateString('pt-BR')}</span>
                          <span className="font-semibold text-blue-600">{formatNumber(item.followers)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {data.participants.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Nenhum participante cadastrado ainda.
                  {isEditing && ' Clique em "Adicionar Participante" para começar.'}
                </div>
              )}
            </div>
          </Card>
        </div>
      </main>

      {/* Modal para adicionar participante */}
      {editingParticipant === 'new' && isEditing && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white rounded-md shadow-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Adicionar Participante</h3>
                <button
                  onClick={() => setEditingParticipant(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newParticipant.name}
                    onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ana Paula Renault"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    O ID será gerado automaticamente baseado no nome (formato: ana-paula-renault)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID Personalizado (opcional)</label>
                  <input
                    type="text"
                    value={newParticipant.id}
                    onChange={(e) => setNewParticipant({ ...newParticipant, id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="ana-paula-renault"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
                  <input
                    type="text"
                    value={newParticipant.instagram || ''}
                    onChange={(e) => setNewParticipant({ ...newParticipant, instagram: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="@ana_paula_renault"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seguidores Iniciais</label>
                  <input
                    type="number"
                    value={newParticipant.followersStart}
                    onChange={(e) => setNewParticipant({ ...newParticipant, followersStart: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center space-x-6">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newParticipant.active}
                      onChange={(e) => setNewParticipant({ ...newParticipant, active: e.target.checked })}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">Ativo</label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newParticipant.eliminated}
                      onChange={(e) => setNewParticipant({ ...newParticipant, eliminated: e.target.checked })}
                      className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">Eliminado</label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setEditingParticipant(null)}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    addParticipant();
                    setEditingParticipant(null);
                  }}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para adicionar histórico */}
      {showAddHistoryModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white rounded-md shadow-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Atualizar Seguidores</h3>
              </div>

              {/* Identificação do participante */}
              {(() => {
                const participant = data?.participants.find(p => p.id === historyParticipantId);
                return participant ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-sm">
                          {participant.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-blue-900">{participant.name}</h4>
                        <p className="text-xs text-blue-600">ID: {participant.id}</p>
                        <p className="text-xs text-blue-600">
                          Seguidores atuais: {formatNumber(participant.followersCurrent)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="space-y-4">
                <button
                  onClick={() => {
                    setShowAddHistoryModal(false);
                    setFollowersInput('');
                    setHistoryParticipantEliminated(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input
                    type="date"
                    value={newHistoryItem.date}
                    onChange={(e) => setNewHistoryItem({ ...newHistoryItem, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de Seguidores</label>
                  <input
                    type="number"
                    value={followersInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFollowersInput(value);
                      const numericValue = parseInt(value) || 0;
                      setNewHistoryItem({ ...newHistoryItem, followers: numericValue });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Digite o número (ex: 2300000)"
                  />
                  {followersInput && parseInt(followersInput) > 0 && (
                    <p className="text-xs text-gray-600 mt-1">
                      Será salvo como: <span className="font-semibold text-blue-600">
                        {formatFollowersDisplay(parseInt(followersInput))}
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={historyParticipantEliminated}
                    onChange={(e) => setHistoryParticipantEliminated(e.target.checked)}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">Marcar como eliminado</label>
                </div>

              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddHistoryModal(false);
                    setFollowersInput('');
                    setHistoryParticipantEliminated(false);
                  }}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    addHistoryItem(historyParticipantId, newHistoryItem);
                    setShowAddHistoryModal(false);
                    setFollowersInput('');
                    setHistoryParticipantEliminated(false);
                  }}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Atualizar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`mb-2 p-4 rounded-md shadow-lg max-w-sm ${
              toast.type === 'success' ? 'bg-green-500 text-white' :
              toast.type === 'error' ? 'bg-red-500 text-white' :
              toast.type === 'warning' ? 'bg-yellow-500 text-black' :
              'bg-blue-500 text-white'
            }`}
          >
            <div className="flex items-center">
              <div className="flex-1">
                <p className="font-medium">{toast.title}</p>
                {toast.message && <p className="text-sm mt-1">{toast.message}</p>}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-4 text-current opacity-75 hover:opacity-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};