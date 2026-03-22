import React from 'react';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { Card } from './Card';
import { ParticipantDropdown } from './ParticipantDropdown';
import { ParedaoSlot } from '../../models/types';
import { getParticipantImage } from '../../utils/avatarUtils';

interface ParticipantOption {
  label: string;
  value: string;
}

interface ParedaoSectionProps {
  slots: ParedaoSlot[];
  isEditing: boolean;
  updateSlot: (slotId: string, participantId: string) => void;
  dirtyIds: Set<string>;
  getParticipantName: (id: string) => string;
  activeParticipants: ParticipantOption[];
}

export const ParedaoSection: React.FC<ParedaoSectionProps> = ({
  slots,
  isEditing,
  updateSlot,
  dirtyIds,
  getParticipantName,
  activeParticipants,
}) => {
  return (
    <Card className={`bg-white border-gray-200 shadow-sm ${isEditing ? 'ring-1 ring-red-200' : ''}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <TrophyIcon className="h-6 w-6 text-red-600 mr-3" />
          <h2 className="text-lg font-semibold text-gray-900">Paredão</h2>
        </div>
        {isEditing && (
          <span className="text-xs font-medium text-red-600">Editing</span>
        )}
      </div>

      {/* Formação do Paredão (estilo TV) */}
      <div className="mt-4">
        <h3 className="text-md font-medium text-gray-900 mb-4">Formação do Paredão</h3>
        <div className="space-y-3">
          {slots.map((slot, index) => {
            const participantName = slot.participantId ? getParticipantName(slot.participantId) : null;
            const isDirty = dirtyIds.has(slot.id);

            return (
              <div
                key={slot.id}
                className={`relative flex items-center gap-4 p-4 bg-gradient-to-r from-red-50 to-red-25 rounded-lg shadow-sm border-2 transition-all duration-200 ${
                  isDirty
                    ? 'border-red-300 bg-red-50 shadow-md'
                    : 'border-red-200 hover:border-red-300 hover:shadow-md'
                } ${isEditing ? 'ring-1 ring-red-200' : ''}`}
                style={!isEditing ? { pointerEvents: 'none', opacity: 0.9 } : undefined}
              >
                {/* Indicador de alteração específico */}
                {isDirty && (
                  <span className="absolute -top-2 -right-2 inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg">
                    Alterado
                  </span>
                )}

                {/* Número da posição */}
                <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 bg-red-600 text-white font-bold rounded-full shadow-md">
                  {slot.position}
                </div>

                {/* Avatar grande */}
                <div className="flex-shrink-0">
                  <div className="relative w-16 h-16 bg-gray-200 rounded-full overflow-hidden border-4 border-white shadow-lg">
                    {slot.participantId && participantName ? (
                      <img
                        src={getParticipantImage(participantName)}
                        alt={participantName || `Posição ${slot.position}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 font-bold text-xl">
                        ?
                      </div>
                    )}
                  </div>
                </div>

                {/* Informações e controles */}
                <div className="flex-grow min-w-0">
                  {isEditing ? (
                    <div className="space-y-2">
                      <ParticipantDropdown
                        options={[
                          { label: 'Vazio', value: '' },
                          ...activeParticipants,
                        ]}
                        value={slot.participantId}
                        onValueChange={(value) => updateSlot(slot.id, value)}
                        placeholder="Selecionar participante..."
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {slot.participantId && participantName ? (
                        <div>
                          <div className="font-semibold text-gray-900 text-lg">{participantName}</div>
                          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            slot.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                            slot.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {slot.status === 'CONFIRMED' ? 'Confirmado' :
                             slot.status === 'PENDING' ? 'Pendente' : 'Não formado'}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-gray-500 font-medium">Posição vazia</div>
                          <div className="text-sm text-gray-400">Nenhum participante selecionado</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};