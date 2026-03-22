import React from 'react';
import {
  TrophyIcon,
  StarIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Card } from './Card';
import { Dropdown } from './Dropdown';
import { ParticipantDropdown } from './ParticipantDropdown';
import { Highlight, HighlightState } from '../../models/types';
import { getParticipantImage } from '../../utils/avatarUtils';

interface ParticipantOption {
  label: string;
  value: string;
}

interface HighlightsSectionProps {
  highlights: Highlight[];
  isEditing: boolean;
  updateHighlight: (highlightId: string, participantId: string, state?: HighlightState) => void;
  dirtyIds: Set<string>;
  getParticipantName: (id: string) => string;
  activeParticipants: ParticipantOption[];
}

const HIGHLIGHT_TYPES = [
  {
    id: 'leader',
    label: 'Líder',
    icon: TrophyIcon,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    ringColor: 'ring-yellow-200'
  },
  {
    id: 'angel',
    label: 'Anjo',
    icon: StarIcon,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    ringColor: 'ring-blue-200'
  },
  {
    id: 'imune',
    label: 'Imune',
    icon: ShieldCheckIcon,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    ringColor: 'ring-green-200'
  },
  {
    id: 'monstro',
    label: 'Monstro',
    icon: ExclamationTriangleIcon,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    ringColor: 'ring-red-200'
  },
];

export const HighlightsSection: React.FC<HighlightsSectionProps> = ({
  highlights,
  isEditing,
  updateHighlight,
  dirtyIds,
  getParticipantName,
  activeParticipants,
}) => {
  return (
    <Card className={`bg-white border-gray-200 shadow-sm ${isEditing ? 'ring-1 ring-indigo-200' : ''}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <StarIcon className="h-6 w-6 text-yellow-600 mr-3" />
          <h2 className="text-lg font-semibold text-gray-900">Highlights (Destaques)</h2>
        </div>
        {isEditing && (
          <span className="text-xs font-medium text-indigo-600">Editing</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {HIGHLIGHT_TYPES.map((highlightType) => {
          const highlight = highlights.find(h => h.type === highlightType.id.toUpperCase());
          if (!highlight) return null;

          const participantName = highlight.participantId ? getParticipantName(highlight.participantId) : null;
          const isDirty = dirtyIds.has(highlight.id);
          const IconComponent = highlightType.icon;

          return (
            <div
              key={highlight.id}
              className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                isDirty
                  ? 'border-blue-300 bg-blue-50 shadow-md'
                  : `${highlightType.borderColor} ${highlightType.bgColor} hover:shadow-md`
              } ${isEditing ? `ring-1 ${highlightType.ringColor}` : ''}`}
            >
              {/* Indicador de alteração específico */}
              {isDirty && (
                <span className="absolute -top-2 -right-2 inline-flex items-center rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg">
                  Editado
                </span>
              )}

              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${highlightType.bgColor} border ${highlightType.borderColor}`}>
                  <IconComponent className={`w-6 h-6 ${highlightType.color}`} />
                </div>
                <div className="flex-1">
                  <span className="font-bold text-gray-700 text-sm">{highlight.title}</span>
                  <div className="text-xs text-gray-500 mt-0.5">{highlightType.label}</div>
                </div>
                {isEditing && (
                  <div className="flex items-center space-x-1">
                    <Dropdown
                      options={[
                        { label: 'Pendente', value: 'PENDING' },
                        { label: 'Confirmado', value: 'CONFIRMED' },
                      ]}
                      value={highlight.state}
                      onValueChange={(value) => updateHighlight(highlight.id, highlight.participantId, value as HighlightState)}
                    />

                    <button
                      onClick={() => updateHighlight(highlight.id, '')}
                      className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                      title="Limpar destaque"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {isEditing ? (
                <ParticipantDropdown
                  options={[
                    { label: 'Nenhum', value: '' },
                    ...activeParticipants,
                  ]}
                  value={highlight.participantId}
                  onValueChange={(value) => updateHighlight(highlight.id, value)}
                  placeholder="Selecionar participante..."
                />
              ) : (
                <div className="mt-2">
                  {highlight.participantId && participantName && participantName.trim() !== '' ? (
                    <div className="flex items-center">
                      <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200 mr-3 border-2 border-white shadow-sm">
                        <img
                          src={getParticipantImage(participantName)}
                          alt={participantName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-900">{participantName}</span>
                        <div className={`text-xs px-2 py-0.5 rounded-full inline-block ml-2 ${
                          highlight.state === 'CONFIRMED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {highlight.state === 'CONFIRMED' ? 'Confirmado' : 'Pendente'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center text-gray-500">
                      <div className="w-8 h-8 rounded-full bg-gray-200 mr-3 border-2 border-gray-300"></div>
                      <span className="text-sm">Não definido</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};