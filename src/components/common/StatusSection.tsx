import React from 'react';
import { CogIcon, PlayIcon, PauseIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { Card } from './Card';
import { Dropdown } from './Dropdown';
import { ParedaoState, VotingStatus } from '../../models/types';

interface StatusSectionProps {
  paredaoState: ParedaoState;
  votingStatus: VotingStatus;
  isEditing: boolean;
  onStateChange: (state: ParedaoState) => void;
  onVotingChange: (status: VotingStatus) => void;
  dirtyFields: Set<string>;
}

const PAREDAO_STATES: { value: ParedaoState; label: string; icon: React.ComponentType<any>; color: string }[] = [
  { value: 'NOT_FORMED', label: 'Não formado', icon: PauseIcon, color: 'text-gray-400' },
  { value: 'FORMED', label: 'Formado', icon: CogIcon, color: 'text-blue-400' },
  { value: 'VOTING', label: 'Em votação', icon: PlayIcon, color: 'text-green-400' },
  { value: 'FINISHED', label: 'Finalizado', icon: CheckCircleIcon, color: 'text-purple-400' },
];

const VOTING_STATUSES: { value: VotingStatus; label: string; icon: React.ComponentType<any>; color: string }[] = [
  { value: 'CLOSED', label: 'Fechada', icon: PauseIcon, color: 'text-red-400' },
  { value: 'OPEN', label: 'Aberta', icon: PlayIcon, color: 'text-green-400' },
  { value: 'FINISHED', label: 'Finalizada', icon: CheckCircleIcon, color: 'text-blue-400' },
];

export const StatusSection: React.FC<StatusSectionProps> = ({
  paredaoState,
  votingStatus,
  isEditing,
  onStateChange,
  onVotingChange,
  dirtyFields,
}) => {
  const currentParedaoState = PAREDAO_STATES.find(s => s.value === paredaoState);
  const currentVotingStatus = VOTING_STATUSES.find(s => s.value === votingStatus);

  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white border-gray-700 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <CogIcon className="h-6 w-6 text-blue-400 mr-3" />
          <h3 className="text-lg font-bold text-white">Controle de Jogo</h3>
        </div>
        {isEditing && (
          <span className="text-xs font-medium text-blue-400 bg-blue-900/50 px-2 py-1 rounded-full">
            Editando
          </span>
        )}
      </div>

      <div className="space-y-6">
        {/* Estado do Paredão */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">
              Estado do Paredão
            </label>
            {dirtyFields.has('paredaoState') && (
              <span className="inline-flex items-center rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                Alterado
              </span>
            )}
          </div>

          {isEditing ? (
            <Dropdown
              options={PAREDAO_STATES}
              value={paredaoState}
              onValueChange={(value) => onStateChange(value as ParedaoState)}
            />
          ) : (
            <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-md">
              {currentParedaoState && (
                <>
                  <currentParedaoState.icon className={`w-5 h-5 ${currentParedaoState.color}`} />
                  <span className="font-medium text-white">{currentParedaoState.label}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Status da Votação */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">
              Status da Votação
            </label>
            {dirtyFields.has('votingStatus') && (
              <span className="inline-flex items-center rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                Alterado
              </span>
            )}
          </div>

          {isEditing ? (
            <Dropdown
              options={VOTING_STATUSES}
              value={votingStatus}
              onValueChange={(value) => onVotingChange(value as VotingStatus)}
            />
          ) : (
            <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-md">
              {currentVotingStatus && (
                <>
                  <currentVotingStatus.icon className={`w-5 h-5 ${currentVotingStatus.color}`} />
                  <span className="font-medium text-white">{currentVotingStatus.label}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Status Visual Geral */}
        {!isEditing && (
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Status Atual
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Paredão:</span>
                <span className={`text-sm font-medium ${currentParedaoState?.color || 'text-gray-400'}`}>
                  {currentParedaoState?.label || paredaoState}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Votação:</span>
                <span className={`text-sm font-medium ${currentVotingStatus?.color || 'text-gray-400'}`}>
                  {currentVotingStatus?.label || votingStatus}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};