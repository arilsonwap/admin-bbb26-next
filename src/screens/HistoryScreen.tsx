'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  TrophyIcon,
  XCircleIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { useAdminStore } from '../store/adminStore';
import { Card } from '../components/common/Card';
import { Dropdown } from '../components/common/Dropdown';
import { HistoricalParedao, ParedaoResult, ParedaoResultStatus } from '../models/types';

interface HistoricalParedaoItemProps {
  paredao: HistoricalParedao;
  onEdit: (paredao: HistoricalParedao) => void;
  onDelete: (paredaoId: string) => void;
  onDuplicate: (paredao: HistoricalParedao) => void;
}

const HistoricalParedaoItem: React.FC<HistoricalParedaoItemProps> = ({
  paredao,
  onEdit,
  onDelete,
  onDuplicate,
}) => {
  const { database } = useAdminStore();

  const getParticipantName = (participantId: string) => {
    const participant = database?.participants[participantId];
    return participant?.name || participantId;
  };

  const getEliminatedParticipants = () => {
    return paredao.results.filter(result => result.status === 'ELIMINADO');
  };

  const getRevealedParticipants = () => {
    return paredao.results.filter(result => result.status === 'SALVO');
  };

  const handleDelete = () => {
    if (confirm(`Tem certeza que deseja excluir o paredão "${paredao.title}"?`)) {
      onDelete(paredao.id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <Card
      title={paredao.title}
      subtitle={`${formatDate(paredao.date)} • ${paredao.results.length} participantes`}
      icon={<TrophyIcon className="h-6 w-6 text-yellow-600" />}
      className="mb-4"
    >
      <div className="space-y-4">
        {/* Informações básicas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-sm font-medium text-gray-700">Título:</span>
            <p className="text-sm text-gray-900">{paredao.title}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700">Data:</span>
            <p className="text-sm text-gray-900">{formatDate(paredao.date)}</p>
          </div>
        </div>

        {/* Subtítulo */}
        {paredao.subtitle && (
          <div>
            <span className="text-sm font-medium text-gray-700">Subtítulo:</span>
            <p className="text-sm text-gray-900">{paredao.subtitle}</p>
          </div>
        )}

        {/* Eliminados */}
        {getEliminatedParticipants().length > 0 && (
          <div>
            <span className="text-sm font-medium text-red-700 flex items-center">
              <XCircleIcon className="h-4 w-4 mr-1" />
              Eliminados:
            </span>
            <div className="flex flex-wrap gap-2 mt-1">
              {getEliminatedParticipants().map((result, index) => (
                <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {getParticipantName(result.participantId)} ({result.media}%)
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Revelados */}
        {getRevealedParticipants().length > 0 && (
          <div>
            <span className="text-sm font-medium text-blue-700 flex items-center">
              <UserGroupIcon className="h-4 w-4 mr-1" />
              Revelados:
            </span>
            <div className="flex flex-wrap gap-2 mt-1">
              {getRevealedParticipants().map((result, index) => (
                <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {getParticipantName(result.participantId)} ({result.media}%)
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex justify-end space-x-2 pt-2 border-t border-gray-200">
          <button
            onClick={() => onDuplicate(paredao)}
            className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            <DocumentDuplicateIcon className="h-4 w-4 mr-1" />
            Duplicar
          </button>
          <button
            onClick={() => onEdit(paredao)}
            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <PencilIcon className="h-4 w-4 mr-1" />
            Editar
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <TrashIcon className="h-4 w-4 mr-1" />
            Excluir
          </button>
        </div>
      </div>
    </Card>
  );
};

interface HistoricalParedaoModalProps {
  visible: boolean;
  paredao: HistoricalParedao | null;
  isDuplicating?: boolean;
  onSave: (paredao: Omit<HistoricalParedao, 'id'>) => void;
  onCancel: () => void;
}

const HistoricalParedaoModal: React.FC<HistoricalParedaoModalProps> = ({
  visible,
  paredao,
  isDuplicating = false,
  onSave,
  onCancel,
}) => {
  const { database } = useAdminStore();
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    date: new Date().toISOString().split('T')[0],
    results: [] as ParedaoResult[],
  });

  // Reset form when modal opens/closes or paredao changes
  React.useEffect(() => {
    if (visible && paredao) {
      if (isDuplicating) {
        // Para duplicação, criar nova data (próxima semana)
        const nextWeek = new Date(paredao.date);
        nextWeek.setDate(nextWeek.getDate() + 7);

        setFormData({
          title: `Paredão ${database?.history.paredoes.length ? database.history.paredoes.length + 1 : 1}`,
          subtitle: paredao.subtitle,
          date: nextWeek.toISOString().split('T')[0],
          results: paredao.results.map(result => ({ ...result })), // Deep copy
        });
      } else {
        // Para edição, usar dados existentes
        setFormData({
          title: paredao.title,
          subtitle: paredao.subtitle || '',
          date: paredao.date,
          results: [...paredao.results],
        });
      }
    } else if (visible && !paredao) {
      // Novo paredão
      setFormData({
        title: `Paredão ${database?.history.paredoes.length ? database.history.paredoes.length + 1 : 1}`,
        subtitle: '',
        date: new Date().toISOString().split('T')[0],
        results: [],
      });
    }
  }, [visible, paredao, isDuplicating, database]);

  const activeParticipants = useMemo(() => {
    if (!database) return [];
    return Object.values(database.participants).filter(p => p.status === 'ATIVO');
  }, [database]);

  const addParticipant = () => {
    const newResult: ParedaoResult = {
      participantId: '',
      media: 0,
      status: 'SALVO',
    };
    setFormData(prev => ({
      ...prev,
      results: [...prev.results, newResult],
    }));
  };

  const removeParticipant = (index: number) => {
    setFormData(prev => ({
      ...prev,
      results: prev.results.filter((_, i) => i !== index),
    }));
  };

  const updateParticipant = (index: number, field: keyof ParedaoResult, value: any) => {
    setFormData(prev => ({
      ...prev,
      results: prev.results.map((result, i) =>
        i === index ? { ...result, [field]: value } : result
      ),
    }));
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      alert('Título é obrigatório');
      return;
    }

    if (formData.results.length === 0) {
      alert('Adicione pelo menos um participante');
      return;
    }

    // Validar se todos os participantes têm ID e porcentagem válida
    for (const result of formData.results) {
      if (!result.participantId) {
        alert('Todos os participantes devem ser selecionados');
        return;
      }
      if (result.media < 0 || result.media > 100) {
        alert('Porcentagem deve estar entre 0 e 100');
        return;
      }
    }

    const now = new Date().toISOString();
    onSave({
      title: formData.title.trim(),
      subtitle: formData.subtitle.trim(),
      date: formData.date,
      results: formData.results,
      createdAt: now,
      updatedAt: now,
    });

    setFormData({
      title: '',
      subtitle: '',
      date: new Date().toISOString().split('T')[0],
      results: [],
    });
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {paredao ? (isDuplicating ? 'Duplicar Paredão' : 'Editar Paredão') : 'Novo Paredão'}
          </h2>

          <div className="space-y-6">
            {/* Informações básicas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Título *
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ex: Paredão 1"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data *
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subtítulo (opcional)
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Ex: Semana 3 - Anjo e Demônio"
                value={formData.subtitle}
                onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
              />
            </div>

            {/* Participantes */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Participantes ({formData.results.length})</h3>
                <button
                  type="button"
                  onClick={addParticipant}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Adicionar
                </button>
              </div>

              {formData.results.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <UserGroupIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>Nenhum participante adicionado</p>
                  <p className="text-sm">Clique em "Adicionar" para incluir participantes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.results.map((result, index) => (
                    <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <Dropdown
                          options={[
                            { label: 'Selecionar participante...', value: '' },
                            ...activeParticipants.map(p => ({
                              label: p.name,
                              value: p.id,
                            })),
                          ]}
                          value={result.participantId}
                          onValueChange={(value) => updateParticipant(index, 'participantId', value)}
                          placeholder="Selecionar participante"
                        />
                      </div>

                      <div className="w-24">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="%"
                          value={result.media || ''}
                          onChange={(e) => updateParticipant(index, 'media', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div className="w-32">
                        <Dropdown
                          options={[
                            { label: 'Revelado', value: 'REVELADO' },
                            { label: 'Eliminado', value: 'ELIMINADO' },
                          ]}
                          value={result.status}
                          onValueChange={(value) => updateParticipant(index, 'status', value as ParedaoResultStatus)}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeParticipant(index)}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                        title="Remover participante"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const HistoryScreen: React.FC = () => {
  const router = useRouter();
  const { database, addHistoricalParedao, updateHistoricalParedao, removeHistoricalParedao } = useAdminStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingHistoricalParedao, setEditingHistoricalParedao] = useState<HistoricalParedao | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const paredoes = useMemo(() => {
    if (!database) return [];
    return database.history.paredoes.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [database]);

  const handleAddHistoricalParedao = () => {
    setEditingHistoricalParedao(null);
    setIsDuplicating(false);
    setModalVisible(true);
  };

  const handleEditHistoricalParedao = (paredao: HistoricalParedao) => {
    setEditingHistoricalParedao(paredao);
    setIsDuplicating(false);
    setModalVisible(true);
  };

  const handleDuplicateHistoricalParedao = (paredao: HistoricalParedao) => {
    setEditingHistoricalParedao(paredao);
    setIsDuplicating(true);
    setModalVisible(true);
  };

  const handleSaveHistoricalParedao = (paredaoData: Omit<HistoricalParedao, 'id'>) => {
    try {
      if (editingHistoricalParedao && !isDuplicating) {
        // Editar existente
        updateHistoricalParedao(editingHistoricalParedao.id, paredaoData);
      } else {
        // Adicionar novo (ou duplicado)
        const newHistoricalParedao: HistoricalParedao = {
          ...paredaoData,
          id: `paredao-${Date.now()}`,
        };
        addHistoricalParedao(newHistoricalParedao);
      }

      setModalVisible(false);
      setEditingHistoricalParedao(null);
      setIsDuplicating(false);
    } catch (error) {
      console.error('Erro ao salvar paredão:', error);
      alert('Erro ao salvar paredão');
    }
  };

  const handleDeleteHistoricalParedao = (paredaoId: string) => {
    try {
      removeHistoricalParedao(paredaoId);
    } catch (error) {
      console.error('Erro ao excluir paredão:', error);
      alert('Erro ao excluir paredão');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Desktop Only */}
      <header className="hidden lg:block bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">Histórico de Paredões</h1>
            <button
              onClick={handleAddHistoricalParedao}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Novo Paredão
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
              <h1 className="text-xl font-semibold text-gray-900">Histórico de Paredões</h1>
            </div>
            <button
              onClick={handleAddHistoricalParedao}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Novo
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="pb-6">
          {paredoes.length === 0 ? (
            <Card
              title="Nenhum paredão cadastrado"
              subtitle="Comece adicionando o primeiro paredão do BBB26"
              icon={<TrophyIcon className="h-6 w-6 text-gray-400" />}
              className="max-w-md mx-auto text-center"
            >
              <p className="text-gray-600 mt-4 mb-6">
                Aqui você pode gerenciar o histórico completo de paredões,
                adicionar novos paredões e editar resultados detalhados.
              </p>
              <button
                onClick={handleAddHistoricalParedao}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Criar Primeiro Paredão
              </button>
            </Card>
          ) : (
            <div className="space-y-4">
              {paredoes.map((paredao) => (
                <HistoricalParedaoItem
                  key={paredao.id}
                  paredao={paredao}
                  onEdit={handleEditHistoricalParedao}
                  onDelete={handleDeleteHistoricalParedao}
                  onDuplicate={handleDuplicateHistoricalParedao}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      <HistoricalParedaoModal
        visible={modalVisible}
        paredao={editingHistoricalParedao}
        isDuplicating={isDuplicating}
        onSave={handleSaveHistoricalParedao}
        onCancel={() => {
          setModalVisible(false);
          setEditingHistoricalParedao(null);
          setIsDuplicating(false);
        }}
      />
    </div>
  );
};