import { useCallback } from 'react';
import { useAdminStore } from '../store/adminStore';
import { AdminDatabase } from '../models/types';

export interface ParticipantValidationResult {
  isValid: boolean;
  exists: boolean;
  status: 'ATIVO' | 'ELIMINADO' | 'DESCLASSIFICADO' | null;
  warnings: string[];
  errors: string[];
}

export const useParticipantValidation = () => {
  const { database } = useAdminStore();

  const validateParticipantForCurrentWeek = (participantId: string): ParticipantValidationResult => {
    const result: ParticipantValidationResult = {
      isValid: false,
      exists: false,
      status: null,
      warnings: [],
      errors: [],
    };

    if (!database) {
      result.errors.push('Database não disponível');
      return result;
    }

    const participant = database.participants[participantId];
    if (!participant) {
      result.warnings.push('Participante não encontrado no cadastro');
      return result;
    }

    result.exists = true;
    result.status = participant.status;

    // Para semana atual: só participantes ATIVOS podem estar em highlights/paredão
    if (participant.status !== 'ATIVO') {
      result.errors.push(`Participante ${participant.status.toLowerCase()} não pode estar na semana atual`);
      return result;
    }

    result.isValid = true;
    return result;
  };

  const validateParticipantForHistory = (participantId: string): ParticipantValidationResult => {
    const result: ParticipantValidationResult = {
      isValid: false,
      exists: false,
      status: null,
      warnings: [],
      errors: [],
    };

    if (!database) {
      result.errors.push('Database não disponível');
      return result;
    }

    const participant = database.participants[participantId];
    if (!participant) {
      result.warnings.push('Participante não encontrado no cadastro (aceitável para histórico)');
      result.isValid = true; // Para histórico, permitir participantes não cadastrados
      return result;
    }

    result.exists = true;
    result.status = participant.status;

    // Para histórico: qualquer status é aceitável
    result.isValid = true;
    return result;
  };

  const validateParticipantsList = (
    participantIds: string[],
    context: 'currentWeek' | 'history'
  ): { [participantId: string]: ParticipantValidationResult } => {
    const results: { [participantId: string]: ParticipantValidationResult } = {};

    participantIds.forEach(id => {
      if (context === 'currentWeek') {
        results[id] = validateParticipantForCurrentWeek(id);
      } else {
        results[id] = validateParticipantForHistory(id);
      }
    });

    return results;
  };

  const getParticipantOptions = (includeInactive: boolean = false) => {
    if (!database) return [];

    return Object.values(database.participants)
      .filter(p => includeInactive || p.status === 'ATIVO')
      .map(p => ({
        label: p.name, // Removido o status para que os avatares funcionem
        value: p.id,
        disabled: !includeInactive && p.status !== 'ATIVO',
      }));
  };

  const getParticipantName = (participantId: string): string => {
    if (!database) return participantId;
    const participant = database.participants[participantId];
    return participant ? participant.name : participantId;
  };

  // Encontrar onde um participante está sendo usado
  const findParticipantUsage = useCallback((participantId: string) => {
    const usage: {
      currentWeek: {
        highlights: string[];
        paredao: string[];
      };
      history: {
        paredoes: string[];
      };
    } = {
      currentWeek: {
        highlights: [],
        paredao: [],
      },
      history: {
        paredoes: [],
      },
    };

    if (!database) return usage;

    // Verificar semana atual - highlights
    database.currentWeek.highlights.forEach(highlight => {
      if (highlight.participantId === participantId) {
        usage.currentWeek.highlights.push(`${highlight.title} (${highlight.state})`);
      }
    });

    // Verificar semana atual - paredão
    database.currentWeek.paredao.forEach(slot => {
      if (slot.participantId === participantId) {
        usage.currentWeek.paredao.push(`Posição ${slot.position}`);
      }
    });

    // Verificar histórico
    database.history.paredoes.forEach(paredao => {
      const isUsed = paredao.results.some(result => result.participantId === participantId);
      if (isUsed) {
        usage.history.paredoes.push(paredao.title);
      }
    });

    return usage;
  }, [database]);

  // Limpar automaticamente um participante de todos os locais
  const clearParticipantFromAllLocations = useCallback((participantId: string, db?: AdminDatabase): AdminDatabase | null => {
    const targetDb = db || database;
    if (!targetDb) return null;

    const updatedDatabase = { ...targetDb };

    // Limpar highlights
    updatedDatabase.currentWeek.highlights = updatedDatabase.currentWeek.highlights.map(highlight =>
      highlight.participantId === participantId
        ? { ...highlight, participantId: '', state: 'PENDING' }
        : highlight
    );

    // Limpar paredão
    updatedDatabase.currentWeek.paredao = updatedDatabase.currentWeek.paredao.map(slot =>
      slot.participantId === participantId
        ? { ...slot, participantId: '' }
        : slot
    );

    return updatedDatabase;
  }, [database]);

  return {
    validateParticipantForCurrentWeek,
    validateParticipantForHistory,
    validateParticipantsList,
    getParticipantOptions,
    getParticipantName,
    findParticipantUsage,
    clearParticipantFromAllLocations,
  };
};