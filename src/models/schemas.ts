import { z } from 'zod';
import {
  AdminDatabaseSchema,
  BBB26ExportSchema,
  ParticipantsStatusExportSchema,
  ParedaoResultsExportSchema,
} from './types';

// Schema para validação do database admin
export const adminDatabaseSchema = AdminDatabaseSchema;

// Schemas para validação dos exports
export const bbb26ExportSchema = BBB26ExportSchema;
export const participantsStatusExportSchema = ParticipantsStatusExportSchema;
export const paredaoResultsExportSchema = ParedaoResultsExportSchema;

// Schema para validar imports dos arquivos existentes
export const legacyBBB26Schema = z.object({
  schemaVersion: z.number().optional(),
  season: z.number().optional(),
  updatedAt: z.string().optional(),
  highlights: z.array(z.object({
    id: z.string(),
    participantId: z.string(),
    type: z.string(),
    title: z.string(),
    state: z.string(),
  })),
  paredao: z.array(z.object({
    id: z.string(),
    participantId: z.string(),
    position: z.number(),
    status: z.string(),
  })),
  paredaoState: z.string(),
  votingStatus: z.string(),
});

export const legacyParticipantsStatusSchema = z.object({
  version: z.number().optional(),
  updatedAt: z.string().optional(),
  participants: z.record(z.string(), z.object({
    status: z.string(),
  })),
});

export const legacyParedaoResultsSchema = z.object({
  version: z.number().optional(),
  updatedAt: z.string().optional(),
  paredoes: z.array(z.object({
    id: z.string(),
    data: z.string(),
    titulo: z.string(),
    subtitulo: z.string(),
    resultados: z.array(z.object({
      id: z.string(),
      name: z.string(),
      media: z.number(),
      status: z.string(),
    })),
  })),
});

// Funções utilitárias de validação
export const validateAdminDatabase = (data: unknown) => {
  return adminDatabaseSchema.safeParse(data);
};

export const validateBBB26Export = (data: unknown) => {
  return bbb26ExportSchema.safeParse(data);
};

export const validateParticipantsStatusExport = (data: unknown) => {
  return participantsStatusExportSchema.safeParse(data);
};

export const validateParedaoResultsExport = (data: unknown) => {
  return paredaoResultsExportSchema.safeParse(data);
};