'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useAdminStore } from '../store/adminStore';
import { Dropdown } from '../components/common/Dropdown';
import { Card } from '../components/common/Card';
import { HighlightType, ParedaoState, VotingStatus, HighlightState } from '../models/types';

export const WeekScreen: React.FC = () => {
  const router = useRouter();
  const {
    database,
    updateHighlight,
    clearHighlight,
    updateParedaoSlot,
    updateParedaoState,
    updateVotingStatus,
    getActiveParticipants,
  } = useAdminStore();

  const activeParticipants = getActiveParticipants();

  const participantOptions = [
    { label: 'Nenhum', value: '' },
    ...activeParticipants.map(p => ({
      label: p.name,
      value: p.id,
    })),
  ];

  const handleHighlightChange = (highlightId: string, participantId: string) => {
    updateHighlight(highlightId, {
      participantId,
      state: participantId ? 'CONFIRMED' : 'PENDING',
    });
  };

  const handleHighlightStateChange = (highlightId: string, state: HighlightState) => {
    updateHighlight(highlightId, { state });
  };

  const handleClearHighlight = (highlightId: string) => {
    if (confirm('Tem certeza que deseja limpar este destaque?')) {
      clearHighlight(highlightId);
    }
  };

  const handleParedaoParticipantChange = (slotId: string, participantId: string) => {
    // Verificar se o participante já está em outro slot
    const existingSlot = database?.currentWeek.paredao.find(
      slot => slot.participantId === participantId && slot.id !== slotId
    );

    if (existingSlot && participantId) {
      alert('Este participante já está em outro slot do paredão.');
      return;
    }

    updateParedaoSlot(slotId, {
      participantId,
      status: participantId ? 'CONFIRMED' : 'NOT_FORMED',
    });
  };

  const handleParedaoStateChange = (state: ParedaoState) => {
    // Validações
    if (state === 'FORMED') {
      const filledSlots = database?.currentWeek.paredao.filter(slot => slot.participantId) || [];
      if (filledSlots.length < 2) {
        alert('Para formar o paredão, é necessário pelo menos 2 participantes.');
        return;
      }
    }

    updateParedaoState(state);
  };

  const handleVotingStatusChange = (status: VotingStatus) => {
    // Validações
    if (status === 'OPEN' && database?.currentWeek.paredaoState === 'NOT_FORMED') {
      alert('Não é possível abrir votação com paredão não formado.');
      return;
    }

    updateVotingStatus(status);
  };

  const highlightStateOptions = [
    { label: 'Confirmado', value: 'CONFIRMED' },
    { label: 'Pendente', value: 'PENDING' },
  ];

  const paredaoStateOptions = [
    { label: 'Não formado', value: 'NOT_FORMED' },
    { label: 'Formado', value: 'FORMED' },
    { label: 'Em votação', value: 'VOTING' },
    { label: 'Finalizado', value: 'FINISHED' },
  ];

  const votingStatusOptions = [
    { label: 'Fechada', value: 'CLOSED' },
    { label: 'Aberta', value: 'OPEN' },
    { label: 'Finalizada', value: 'FINISHED' },
  ];

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
            <h1 className="text-xl font-semibold text-gray-900">Semana Atual</h1>
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
              <h1 className="text-xl font-semibold text-gray-900">Semana Atual</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          {/* Highlights */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Destaques da Semana</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {database.currentWeek.highlights.map((highlight) => (
                <Card
                  key={highlight.id}
                  title={highlight.title}
                  className="p-6"
                >
                  <div className="space-y-4">
                    <Dropdown
                      options={participantOptions}
                      value={highlight.participantId}
                      onValueChange={(value) => handleHighlightChange(highlight.id, value)}
                      placeholder="Selecionar participante"
                      label="Participante"
                    />

                    <Dropdown
                      options={highlightStateOptions}
                      value={highlight.state}
                      onValueChange={(value) => handleHighlightStateChange(highlight.id, value as HighlightState)}
                      label="Status"
                    />

                    <button
                      onClick={() => handleClearHighlight(highlight.id)}
                      className="w-full px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                    >
                      Limpar
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Paredão */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Paredão da Semana</h2>

            {/* Configurações do Paredão */}
            <Card title="Configurações do Paredão" className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Dropdown
                  options={paredaoStateOptions}
                  value={database.currentWeek.paredaoState}
                  onValueChange={(value) => handleParedaoStateChange(value as ParedaoState)}
                  label="Estado do paredão"
                />

                <Dropdown
                  options={votingStatusOptions}
                  value={database.currentWeek.votingStatus}
                  onValueChange={(value) => handleVotingStatusChange(value as VotingStatus)}
                  label="Status da votação"
                />
              </div>
            </Card>

            {/* Slots do Paredão */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {database.currentWeek.paredao.map((slot) => (
                <Card
                  key={slot.id}
                  title={`Posição ${slot.position}`}
                  className="p-6"
                >
                  <div className="space-y-4">
                    <Dropdown
                      options={participantOptions}
                      value={slot.participantId}
                      onValueChange={(value) => handleParedaoParticipantChange(slot.id, value)}
                      placeholder="Selecionar participante"
                      label="Participante"
                    />

                    <div className="text-sm text-gray-600">
                      Status: {slot.status === 'CONFIRMED' ? (
                        <span className="inline-flex items-center text-green-600">
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          Confirmado
                        </span>
                      ) : slot.status === 'PENDING' ? (
                        <span className="text-yellow-600">Pendente</span>
                      ) : (
                        <span className="text-gray-600">Não formado</span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};