'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, UserPlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useAdminStore } from '../store/adminStore';
import { StatusChip } from '../components/common/Chip';
import { Dropdown } from '../components/common/Dropdown';
import { Participant, ParticipantStatus } from '../models/types';
import { generateParticipantId } from '../services/importService';

type FilterStatus = 'TODOS' | ParticipantStatus;

interface ParticipantItemProps {
  participant: Participant;
  onEdit: (participant: Participant) => void;
  onDelete: (id: string) => void;
}

const ParticipantItem: React.FC<ParticipantItemProps> = ({
  participant,
  onEdit,
  onDelete,
}) => {
  const handleDelete = () => {
    if (confirm(`Tem certeza que deseja excluir ${participant.name}?`)) {
      onDelete(participant.id);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900">{participant.name}</h3>
          <p className="text-sm text-gray-600">ID: {participant.id}</p>
          <div className="mt-2">
            <StatusChip status={participant.status} />
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => onEdit(participant)}
            className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors"
            title="Editar"
          >
            <PencilIcon className="h-5 w-5" />
          </button>

          <button
            onClick={handleDelete}
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

interface EditParticipantModalProps {
  visible: boolean;
  participant: Participant | null;
  onSave: (participant: Omit<Participant, 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const EditParticipantModal: React.FC<EditParticipantModalProps> = ({
  visible,
  participant,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(participant?.name || '');
  const [status, setStatus] = useState<ParticipantStatus>(participant?.status || 'ATIVO');
  const [customId, setCustomId] = useState(participant?.id || '');

  React.useEffect(() => {
    if (participant) {
      setName(participant.name);
      setStatus(participant.status);
      setCustomId(participant.id);
    } else {
      setName('');
      setStatus('ATIVO');
      setCustomId('');
    }
  }, [participant]);

  const handleGenerateId = () => {
    if (name.trim()) {
      const generatedId = generateParticipantId(name);
      setCustomId(generatedId);
    }
  };

  const handleSave = () => {
    if (!name.trim() || !customId.trim()) {
      alert('Nome e ID são obrigatórios');
      return;
    }

    onSave({
      id: customId.trim(),
      name: name.trim(),
      status,
    });

    setName('');
    setCustomId('');
    setStatus('ATIVO');
  };

  const statusOptions = [
    { label: 'Ativo', value: 'ATIVO' },
    { label: 'Eliminado', value: 'ELIMINADO' },
    { label: 'Desclassificado', value: 'DESCLASSIFICADO' },
  ];

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {participant ? 'Editar Participante' : 'Novo Participante'}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome do participante
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Nome do participante"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID do participante
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="ID do participante"
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleGenerateId}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  title="Gerar ID automaticamente"
                >
                  Gerar
                </button>
              </div>
            </div>

            <div>
              <Dropdown
                options={statusOptions}
                value={status}
                onValueChange={(value) => setStatus(value as ParticipantStatus)}
                label="Status"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
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

export const ParticipantsScreen: React.FC = () => {
  const router = useRouter();
  const { database, addParticipant, updateParticipant, removeParticipant } = useAdminStore();
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('TODOS');
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const participants = useMemo(() => {
    if (!database) return [];

    let filtered = Object.values(database.participants);

    // Filtro por status
    if (filterStatus !== 'TODOS') {
      filtered = filtered.filter(p => p.status === filterStatus);
    }

    // Filtro por busca
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(search) ||
        p.id.toLowerCase().includes(search)
      );
    }

    // Ordenar por nome
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [database, filterStatus, searchText]);

  const handleAddParticipant = () => {
    setEditingParticipant(null);
    setModalVisible(true);
  };

  const handleEditParticipant = (participant: Participant) => {
    setEditingParticipant(participant);
    setModalVisible(true);
  };

  const handleSaveParticipant = (participantData: Omit<Participant, 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingParticipant) {
        // Verificar se o ID mudou e se já existe
        if (editingParticipant.id !== participantData.id &&
            database?.participants[participantData.id]) {
          alert('Já existe um participante com este ID');
          return;
        }

        updateParticipant(editingParticipant.id, participantData);
      } else {
        // Verificar se o ID já existe
        if (database?.participants[participantData.id]) {
          alert('Já existe um participante com este ID');
          return;
        }

        addParticipant(participantData);
      }

      setModalVisible(false);
      setEditingParticipant(null);
    } catch (error) {
      alert('Erro ao salvar participante');
    }
  };

  const handleDeleteParticipant = (id: string) => {
    removeParticipant(id);
  };

  const filterOptions = [
    { label: 'Todos', value: 'TODOS' },
    { label: 'Ativos', value: 'ATIVO' },
    { label: 'Eliminados', value: 'ELIMINADO' },
    { label: 'Desclassificados', value: 'DESCLASSIFICADO' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Desktop Only */}
      <header className="hidden lg:block bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">Participantes</h1>

            <button
              onClick={handleAddParticipant}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <UserPlusIcon className="h-4 w-4 mr-2" />
              Adicionar
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
              <h1 className="text-xl font-semibold text-gray-900">Participantes</h1>
            </div>

            <button
              onClick={handleAddParticipant}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <UserPlusIcon className="h-4 w-4 mr-2" />
              Adicionar
            </button>
          </div>
        </div>
      </header>

      {/* Filtros */}
      <div className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar participante
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Digite nome ou ID..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            <div>
              <Dropdown
                options={filterOptions}
                value={filterStatus}
                onValueChange={(value) => setFilterStatus(value as FilterStatus)}
                label="Filtrar por status"
                placeholder="Selecionar status"
              />
            </div>
          </div>
        </div>

        {/* Lista */}
        <div className="space-y-4">
          {participants.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
              <UserPlusIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchText || filterStatus !== 'TODOS'
                  ? 'Nenhum participante encontrado'
                  : 'Nenhum participante cadastrado'}
              </h3>
              <p className="text-gray-600">
                {searchText || filterStatus !== 'TODOS'
                  ? 'Tente ajustar os filtros de busca'
                  : 'Comece adicionando o primeiro participante'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {participants.map((participant) => (
                <ParticipantItem
                  key={participant.id}
                  participant={participant}
                  onEdit={handleEditParticipant}
                  onDelete={handleDeleteParticipant}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de edição */}
      <EditParticipantModal
        visible={modalVisible}
        participant={editingParticipant}
        onSave={handleSaveParticipant}
        onCancel={() => {
          setModalVisible(false);
          setEditingParticipant(null);
        }}
      />
    </div>
  );
};