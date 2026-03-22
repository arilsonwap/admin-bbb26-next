import {
  AdminDatabase,
  BBB26Export,
  ParticipantsStatusExport,
  ParedaoResultsExport,
  Participant,
} from '../models/types';
import { legacyBBB26Schema, legacyParticipantsStatusSchema, legacyParedaoResultsSchema } from '../models/schemas';

// Função para gerar slug a partir do nome
export const generateParticipantId = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais (exceto hífen e espaço)
    .replace(/[\s_]+/g, '-') // Substitui espaços e underscores por hífen
    .replace(/-+/g, '-') // Remove hífens duplicados
    .replace(/^-+|-+$/g, ''); // Remove hífens do início e fim
};

// Função para normalizar status
export const normalizeParticipantStatus = (status: string): 'ATIVO' | 'ELIMINADO' | 'DESCLASSIFICADO' => {
  const upper = status.toUpperCase().trim();
  if (upper === 'ATIVO' || upper === 'ACTIVE') return 'ATIVO';
  if (upper === 'ELIMINADO' || upper === 'ELIMINATED' || upper === 'ELIMINADO') return 'ELIMINADO';
  if (upper === 'DESCLASSIFICADO' || upper === 'DISQUALIFIED') return 'DESCLASSIFICADO';
  return 'ATIVO'; // fallback seguro
};

// Função para normalizar estado do highlight
export const normalizeHighlightState = (state: string): 'CONFIRMED' | 'PENDING' => {
  const upper = state.toUpperCase().trim();
  if (upper === 'CONFIRMED' || upper === 'CONFIRMADO') return 'CONFIRMED';
  if (upper === 'PENDING' || upper === 'PENDENTE') return 'PENDING';
  return 'PENDING'; // fallback
};

// Função para normalizar status do slot do paredão
export const normalizeParedaoSlotStatus = (status: string): 'NOT_FORMED' | 'CONFIRMED' | 'PENDING' => {
  const upper = status.toUpperCase().trim();
  if (upper === 'NOT_FORMED' || upper === 'NAO_FORMADO') return 'NOT_FORMED';
  if (upper === 'CONFIRMED' || upper === 'CONFIRMADO') return 'CONFIRMED';
  if (upper === 'PENDING' || upper === 'PENDENTE') return 'PENDING';
  return 'NOT_FORMED'; // fallback
};

// Função para normalizar estado do paredão
export const normalizeParedaoState = (state: string): 'NOT_FORMED' | 'FORMED' | 'VOTING' | 'FINISHED' => {
  const upper = state.toUpperCase().trim();
  if (upper === 'NOT_FORMED' || upper === 'NAO_FORMADO') return 'NOT_FORMED';
  if (upper === 'FORMED' || upper === 'FORMADO') return 'FORMED';
  if (upper === 'VOTING' || upper === 'VOTANDO') return 'VOTING';
  if (upper === 'FINISHED' || upper === 'FINALIZADO') return 'FINISHED';
  return 'NOT_FORMED'; // fallback
};

// Função para normalizar status da votação
export const normalizeVotingStatus = (status: string): 'CLOSED' | 'OPEN' | 'FINISHED' => {
  const upper = status.toUpperCase().trim();
  if (upper === 'CLOSED' || upper === 'FECHADO') return 'CLOSED';
  if (upper === 'OPEN' || upper === 'ABERTO') return 'OPEN';
  if (upper === 'FINISHED' || upper === 'FINALIZADO') return 'FINISHED';
  return 'CLOSED'; // fallback
};

// Função para normalizar status do resultado do paredão
export const normalizeParedaoResultStatus = (status: string): 'ELIMINADO' | 'SALVO' => {
  const upper = status.toUpperCase().trim();
  if (upper === 'ELIMINADO' || upper === 'ELIMINATED') return 'ELIMINADO';
  if (upper === 'SALVO' || upper === 'SAVED') return 'SALVO';
  return 'SALVO'; // fallback
};

// Função para criar participante a partir dos dados legados
const createParticipantFromLegacy = (
  id: string,
  status: Participant['status'],
  name?: string
): Participant => {
  const now = new Date().toISOString();
  const displayName = name || id.split('-').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');

  return {
    id,
    name: displayName,
    status,
    createdAt: now,
    updatedAt: now,
  };
};

// Importar dados dos 3 arquivos JSON legados
export const importFromLegacyFiles = async (
  bbb26Data: unknown,
  participantsData: unknown,
  paredaoData: unknown
): Promise<AdminDatabase> => {
  // Validar dados de entrada
  const bbb26Validated = legacyBBB26Schema.safeParse(bbb26Data);
  const participantsValidated = legacyParticipantsStatusSchema.safeParse(participantsData);
  const paredaoValidated = legacyParedaoResultsSchema.safeParse(paredaoData);

  if (!bbb26Validated.success) {
    throw new Error(`Erro ao validar bbb26.json: ${bbb26Validated.error.message}`);
  }

  if (!participantsValidated.success) {
    throw new Error(`Erro ao validar participants-status.json: ${participantsValidated.error.message}`);
  }

  if (!paredaoValidated.success) {
    throw new Error(`Erro ao validar paredao-results.json: ${paredaoValidated.error.message}`);
  }

  const bbb26 = bbb26Validated.data;
  const participantsStatus = participantsValidated.data;
  const paredaoResults = paredaoValidated.data;

  // Criar mapa de participantes
  const participants: Record<string, Participant> = {};

  // Adicionar participantes do status
  Object.entries(participantsStatus.participants).forEach(([id, data]) => {
    participants[id] = createParticipantFromLegacy(id, normalizeParticipantStatus(data.status));
  });

  // NOTA: Para manter compatibilidade perfeita, só trabalhar com participantes
  // que já existem no participants-status.json. Não criar novos participantes
  // automaticamente dos highlights ou paredão.

  // Para participantes do histórico, só atualizar nome se já existir no participants-status
  // NOTA: Não criar novos participantes do histórico para manter compatibilidade

  // Atualizar status baseado no histórico (só para participantes que existem no participants-status)
  paredaoResults.paredoes.forEach((paredao) => {
    paredao.resultados.forEach((resultado) => {
      if (resultado.status === 'ELIMINADO' && participants[resultado.id]) {
        // Só marcar como eliminado se o participante existir no participants-status
        participants[resultado.id].status = 'ELIMINADO';
      }
    });
  });

  // Criar database
  const now = new Date().toISOString();
  const database: AdminDatabase = {
    version: Math.max(
      bbb26.schemaVersion || 1,
      (participantsStatus as any).version || 1,
      paredaoResults.version || 1
    ),
    season: bbb26.season || 26,
    participants,
    currentWeek: {
      highlights: bbb26.highlights.map((h) => ({
        id: h.id,
        participantId: h.participantId,
        type: h.type as any,
        title: h.title,
        state: normalizeHighlightState(h.state),
      })),
      paredao: bbb26.paredao.map((p) => ({
        id: p.id,
        participantId: p.participantId,
        position: p.position,
        status: normalizeParedaoSlotStatus(p.status),
      })),
      paredaoState: normalizeParedaoState(bbb26.paredaoState),
      votingStatus: normalizeVotingStatus(bbb26.votingStatus),
      updatedAt: bbb26.updatedAt || now,
    },
    history: {
      paredoes: paredaoResults.paredoes.map((p) => ({
        id: p.id,
        date: p.data,
        title: p.titulo,
        subtitle: p.subtitulo,
        results: p.resultados.map((r) => ({
          participantId: r.id,
          media: r.media,
          status: normalizeParedaoResultStatus(r.status),
        })),
        createdAt: now,
        updatedAt: now,
      })),
      updatedAt: paredaoResults.updatedAt || now,
    },
    createdAt: now,
    updatedAt: now,
  };

  return database;
};

// Importar apenas do admin-db.json
export const importFromAdminDatabase = (data: unknown): AdminDatabase => {
  // Implementar validação e conversão se necessário
  return data as AdminDatabase;
};