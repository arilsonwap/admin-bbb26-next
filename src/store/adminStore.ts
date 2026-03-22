import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { AdminDatabase, ValidationError, Participant, Highlight, ParedaoSlot, HistoricalParedao } from '../models/types';

interface AdminStore {
  // Estado principal
  database: AdminDatabase | null;
  isLoading: boolean;
  errors: ValidationError[];
  hasUnsavedChanges: boolean;

  // Ações do database
  setDatabase: (database: AdminDatabase | null) => void;
  updateDatabase: (updater: (db: AdminDatabase) => AdminDatabase) => void;
  setLoading: (loading: boolean) => void;
  setErrors: (errors: ValidationError[]) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;

  // Ações dos participantes
  addParticipant: (participant: Omit<Participant, 'createdAt' | 'updatedAt'>) => void;
  updateParticipant: (id: string, updates: Partial<Participant>) => void;
  removeParticipant: (id: string) => void;

  // Ações da semana atual
  updateHighlight: (id: string, updates: Partial<Highlight>) => void;
  clearHighlight: (id: string) => void;
  updateParedaoSlot: (id: string, updates: Partial<ParedaoSlot>) => void;
  updateParedaoState: (state: AdminDatabase['currentWeek']['paredaoState']) => void;
  updateVotingStatus: (status: AdminDatabase['currentWeek']['votingStatus']) => void;

  // Ações do histórico
  addHistoricalParedao: (paredao: Omit<HistoricalParedao, 'createdAt' | 'updatedAt'>) => void;
  updateHistoricalParedao: (id: string, updates: Partial<HistoricalParedao>) => void;
  removeHistoricalParedao: (id: string) => void;

  // Utilitários
  getParticipantById: (id: string) => Participant | undefined;
  getActiveParticipants: () => Participant[];
  getParticipantsByStatus: (status: Participant['status']) => Participant[];
  validateDatabase: () => ValidationError[];
}

const createInitialDatabase = (): AdminDatabase => ({
  version: 1,
  season: 26,
  participants: {},
  currentWeek: {
    highlights: [
      {
        id: 'leader',
        participantId: '',
        type: 'LEADER',
        title: 'Líder da Semana',
        state: 'PENDING',
      },
      {
        id: 'angel',
        participantId: '',
        type: 'ANGEL',
        title: 'Anjo da Semana',
        state: 'PENDING',
      },
      {
        id: 'imune',
        participantId: '',
        type: 'IMUNE',
        title: 'Imune',
        state: 'PENDING',
      },
      {
        id: 'monstro',
        participantId: '',
        type: 'MONSTRO',
        title: 'Monstro',
        state: 'PENDING',
      },
    ],
    paredao: [
      { id: 'p1', participantId: '', position: 1, status: 'NOT_FORMED' },
      { id: 'p2', participantId: '', position: 2, status: 'NOT_FORMED' },
      { id: 'p3', participantId: '', position: 3, status: 'NOT_FORMED' },
      { id: 'p4', participantId: '', position: 4, status: 'NOT_FORMED' },
    ],
    paredaoState: 'NOT_FORMED',
    votingStatus: 'CLOSED',
    updatedAt: new Date().toISOString(),
  },
  history: {
    paredoes: [],
    updatedAt: new Date().toISOString(),
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const useAdminStore = create<AdminStore>()(
  subscribeWithSelector((set, get) => ({
    // Estado inicial
    database: null,
    isLoading: false,
    errors: [],
    hasUnsavedChanges: false,

    // Ações do database
    setDatabase: (database) => set({ database }),
    updateDatabase: (updater) => {
      const { database } = get();
      if (!database) return;

      const updatedDatabase = updater(database);
      updatedDatabase.updatedAt = new Date().toISOString();

      set({
        database: updatedDatabase,
        hasUnsavedChanges: true,
      });
    },
    setLoading: (loading) => set({ isLoading: loading }),
    setErrors: (errors) => set({ errors }),
    setHasUnsavedChanges: (hasChanges) => set({ hasUnsavedChanges: hasChanges }),

    // Ações dos participantes
    addParticipant: (participantData) => {
      const { updateDatabase } = get();
      const now = new Date().toISOString();

      updateDatabase((db) => ({
        ...db,
        participants: {
          ...db.participants,
          [participantData.id]: {
            ...participantData,
            createdAt: now,
            updatedAt: now,
          },
        },
      }));
    },

    updateParticipant: (id, updates) => {
      const { updateDatabase } = get();
      updateDatabase((db) => ({
        ...db,
        participants: {
          ...db.participants,
          [id]: {
            ...db.participants[id],
            ...updates,
            updatedAt: new Date().toISOString(),
          },
        },
      }));
    },

    removeParticipant: (id) => {
      const { updateDatabase } = get();
      updateDatabase((db) => {
        const { [id]: removed, ...rest } = db.participants;
        return {
          ...db,
          participants: rest,
        };
      });
    },

    // Ações da semana atual
    updateHighlight: (id, updates) => {
      const { updateDatabase } = get();
      updateDatabase((db) => ({
        ...db,
        currentWeek: {
          ...db.currentWeek,
          highlights: db.currentWeek.highlights.map((highlight) =>
            highlight.id === id ? { ...highlight, ...updates } : highlight
          ),
          updatedAt: new Date().toISOString(),
        },
      }));
    },

    clearHighlight: (id) => {
      const { updateDatabase } = get();
      updateDatabase((db) => ({
        ...db,
        currentWeek: {
          ...db.currentWeek,
          highlights: db.currentWeek.highlights.map((highlight) =>
            highlight.id === id
              ? { ...highlight, participantId: '', state: 'PENDING' }
              : highlight
          ),
          updatedAt: new Date().toISOString(),
        },
      }));
    },

    updateParedaoSlot: (id, updates) => {
      const { updateDatabase } = get();
      updateDatabase((db) => ({
        ...db,
        currentWeek: {
          ...db.currentWeek,
          paredao: db.currentWeek.paredao.map((slot) =>
            slot.id === id ? { ...slot, ...updates } : slot
          ),
          updatedAt: new Date().toISOString(),
        },
      }));
    },

    updateParedaoState: (state) => {
      const { updateDatabase } = get();
      updateDatabase((db) => ({
        ...db,
        currentWeek: {
          ...db.currentWeek,
          paredaoState: state,
          updatedAt: new Date().toISOString(),
        },
      }));
    },

    updateVotingStatus: (status) => {
      const { updateDatabase } = get();
      updateDatabase((db) => ({
        ...db,
        currentWeek: {
          ...db.currentWeek,
          votingStatus: status,
          updatedAt: new Date().toISOString(),
        },
      }));
    },

    // Ações do histórico
    addHistoricalParedao: (paredaoData) => {
      const { updateDatabase } = get();
      const now = new Date().toISOString();

      updateDatabase((db) => ({
        ...db,
        history: {
          ...db.history,
          paredoes: [
            ...db.history.paredoes,
            {
              ...paredaoData,
              createdAt: now,
              updatedAt: now,
            },
          ],
          updatedAt: now,
        },
      }));
    },

    updateHistoricalParedao: (id, updates) => {
      const { updateDatabase } = get();
      updateDatabase((db) => ({
        ...db,
        history: {
          ...db.history,
          paredoes: db.history.paredoes.map((paredao) =>
            paredao.id === id
              ? { ...paredao, ...updates, updatedAt: new Date().toISOString() }
              : paredao
          ),
          updatedAt: new Date().toISOString(),
        },
      }));
    },

    removeHistoricalParedao: (id) => {
      const { updateDatabase } = get();
      updateDatabase((db) => ({
        ...db,
        history: {
          ...db.history,
          paredoes: db.history.paredoes.filter((paredao) => paredao.id !== id),
          updatedAt: new Date().toISOString(),
        },
      }));
    },

    // Utilitários
    getParticipantById: (id) => {
      const { database } = get();
      return database?.participants[id];
    },

    getActiveParticipants: () => {
      const { database } = get();
      if (!database) return [];

      return Object.values(database.participants).filter(
        (participant) => participant.status === 'ATIVO'
      );
    },

    getParticipantsByStatus: (status) => {
      const { database } = get();
      if (!database) return [];

      return Object.values(database.participants).filter(
        (participant) => participant.status === status
      );
    },

    validateDatabase: () => {
      const { database } = get();
      if (!database) return [];

      const errors: ValidationError[] = [];

      // Validações dos participantes
      const participantIds = Object.keys(database.participants);
      if (participantIds.length === 0) {
        errors.push({
          type: 'ERROR',
          section: 'participants',
          field: 'count',
          message: 'Deve haver pelo menos um participante cadastrado',
        });
      }

      // Validações da semana atual
      const activeParticipants = Object.values(database.participants).filter(
        (p) => p.status === 'ATIVO'
      );

      // Verificar highlights com participantes eliminados
      database.currentWeek.highlights.forEach((highlight) => {
        if (highlight.participantId) {
          const participant = database.participants[highlight.participantId];
          if (participant && participant.status !== 'ATIVO') {
            errors.push({
              type: 'ERROR',
              section: 'currentWeek',
              field: `highlights.${highlight.id}`,
              message: `Participante ${participant.name} está ${participant.status.toLowerCase()} mas foi selecionado para ${highlight.title.toLowerCase()}`,
              itemId: highlight.id,
              suggestedAction: 'Remover este participante do highlight ou alterar seu status',
            });
          }
        }
      });

      // Verificar paredão com participantes eliminados ou repetidos
      const paredaoParticipantIds = database.currentWeek.paredao
        .map((slot) => slot.participantId)
        .filter((id) => id !== '');

      // Participantes repetidos no paredão
      const uniqueParedaoIds = [...new Set(paredaoParticipantIds)];
      if (uniqueParedaoIds.length !== paredaoParticipantIds.length) {
        errors.push({
          type: 'ERROR',
          section: 'currentWeek',
          field: 'paredao',
          message: 'Há participantes repetidos no paredão',
          suggestedAction: 'Remover duplicatas do paredão',
        });
      }

      // Participantes eliminados no paredão
      database.currentWeek.paredao.forEach((slot) => {
        if (slot.participantId) {
          const participant = database.participants[slot.participantId];
          if (participant && participant.status !== 'ATIVO') {
            errors.push({
              type: 'ERROR',
              section: 'currentWeek',
              field: `paredao.${slot.id}`,
              message: `Participante ${participant.name} está ${participant.status.toLowerCase()} mas foi colocado no paredão`,
              itemId: slot.id,
              suggestedAction: 'Remover este participante do paredão',
            });
          }
        }
      });

      // Validações do estado do paredão
      const filledSlots = database.currentWeek.paredao.filter(
        (slot) => slot.participantId !== ''
      );

      if (database.currentWeek.paredaoState === 'FORMED' && filledSlots.length < 2) {
        errors.push({
          type: 'ERROR',
          section: 'currentWeek',
          field: 'paredaoState',
          message: 'Paredão formado deve ter pelo menos 2 participantes',
          suggestedAction: 'Alterar estado para NOT_FORMED ou adicionar mais participantes',
        });
      }

      if (database.currentWeek.votingStatus === 'OPEN' && database.currentWeek.paredaoState === 'NOT_FORMED') {
        errors.push({
          type: 'ERROR',
          section: 'currentWeek',
          field: 'votingStatus',
          message: 'Não é possível abrir votação com paredão não formado',
          suggestedAction: 'Formar o paredão primeiro ou fechar a votação',
        });
      }

      // Validações do histórico
      database.history.paredoes.forEach((paredao) => {
        // Verificar se há exatamente um eliminado por paredão
        const eliminados = paredao.results.filter((r) => r.status === 'ELIMINADO');
        if (eliminados.length !== 1) {
          errors.push({
            type: 'ERROR',
            section: 'history',
            field: `paredoes.${paredao.id}.results`,
            message: `Paredão deve ter exatamente 1 eliminado, encontrado ${eliminados.length}`,
            itemId: paredao.id,
            suggestedAction: 'Corrigir status dos resultados',
          });
        }

        // Verificar se participantes existem
        paredao.results.forEach((result) => {
          if (!database.participants[result.participantId]) {
            errors.push({
              type: 'WARNING',
              section: 'history',
              field: `paredoes.${paredao.id}.results`,
              message: `Participante ${result.participantId} não encontrado na lista de participantes`,
              itemId: paredao.id,
            });
          }
        });
      });

      return errors;
    },
  }))
);

// Exportar função para criar database inicial
export { createInitialDatabase };