import { z } from 'zod';

// Status dos participantes
export const ParticipantStatusSchema = z.enum(['ATIVO', 'ELIMINADO', 'DESCLASSIFICADO']);
export type ParticipantStatus = z.infer<typeof ParticipantStatusSchema>;

// Participante
export const ParticipantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: ParticipantStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Participant = z.infer<typeof ParticipantSchema>;

// Tipos de highlight
export const HighlightTypeSchema = z.enum(['LEADER', 'ANGEL', 'IMUNE', 'MONSTRO']);
export type HighlightType = z.infer<typeof HighlightTypeSchema>;

// Estados dos highlights
export const HighlightStateSchema = z.enum(['CONFIRMED', 'PENDING']);
export type HighlightState = z.infer<typeof HighlightStateSchema>;

// Highlight (líder, anjo, imune, monstro)
export const HighlightSchema = z.object({
  id: z.string().min(1),
  participantId: z.string().min(1),
  type: HighlightTypeSchema,
  title: z.string().min(1),
  state: HighlightStateSchema,
});
export type Highlight = z.infer<typeof HighlightSchema>;

// Estados do slot do paredão
export const ParedaoSlotStatusSchema = z.enum(['NOT_FORMED', 'CONFIRMED', 'PENDING']);
export type ParedaoSlotStatus = z.infer<typeof ParedaoSlotStatusSchema>;

// Slot do paredão
export const ParedaoSlotSchema = z.object({
  id: z.string().min(1),
  participantId: z.string(), // pode ser vazio
  position: z.number().int().positive(),
  status: ParedaoSlotStatusSchema,
});
export type ParedaoSlot = z.infer<typeof ParedaoSlotSchema>;

// Estados do paredão
export const ParedaoStateSchema = z.enum(['NOT_FORMED', 'FORMED', 'VOTING', 'FINISHED']);
export type ParedaoState = z.infer<typeof ParedaoStateSchema>;

// Status da votação
export const VotingStatusSchema = z.enum(['CLOSED', 'OPEN', 'FINISHED']);
export type VotingStatus = z.infer<typeof VotingStatusSchema>;

// Semana atual
export const CurrentWeekSchema = z.object({
  highlights: z.array(HighlightSchema),
  paredao: z.array(ParedaoSlotSchema),
  paredaoState: ParedaoStateSchema,
  votingStatus: VotingStatusSchema,
  updatedAt: z.string().datetime(),
  importHash: z.string().optional(), // Para detectar reimportações idênticas
});
export type CurrentWeek = z.infer<typeof CurrentWeekSchema>;

// Status do resultado do paredão
export const ParedaoResultStatusSchema = z.enum(['ELIMINADO', 'SALVO']);
export type ParedaoResultStatus = z.infer<typeof ParedaoResultStatusSchema>;

// Resultado individual do paredão
export const ParedaoResultSchema = z.object({
  participantId: z.string().min(1),
  media: z.number().positive(),
  status: ParedaoResultStatusSchema,
});
export type ParedaoResult = z.infer<typeof ParedaoResultSchema>;

// Paredão histórico
export const HistoricalParedaoSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // formato YYYY-MM-DD
  title: z.string().min(1),
  subtitle: z.string().min(1),
  results: z.array(ParedaoResultSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HistoricalParedao = z.infer<typeof HistoricalParedaoSchema>;

// Histórico completo
export const HistorySchema = z.object({
  paredoes: z.array(HistoricalParedaoSchema),
  updatedAt: z.string().datetime(),
});
export type History = z.infer<typeof HistorySchema>;

// Database único (fonte de verdade)
export const AdminDatabaseSchema = z.object({
  version: z.number().int().positive(),
  season: z.number().int().positive(),
  participants: z.record(z.string(), ParticipantSchema), // chave é o participantId
  currentWeek: CurrentWeekSchema,
  history: HistorySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AdminDatabase = z.infer<typeof AdminDatabaseSchema>;

// Tipos de erro de validação
export const ValidationErrorTypeSchema = z.enum(['ERROR', 'WARNING', 'INFO']);
export type ValidationErrorType = z.infer<typeof ValidationErrorTypeSchema>;

export const ValidationErrorSchema = z.object({
  type: ValidationErrorTypeSchema,
  section: z.string().min(1), // 'participants', 'currentWeek', 'history'
  field: z.string().min(1),
  message: z.string().min(1),
  itemId: z.string().optional(), // ID do item específico
  suggestedAction: z.string().optional(),
});
export type ValidationError = z.infer<typeof ValidationErrorSchema>;

// Tipos para exportação
export const BBB26ExportSchema = z.object({
  schemaVersion: z.number().int().positive(),
  season: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  highlights: z.array(HighlightSchema),
  paredao: z.array(ParedaoSlotSchema),
  paredaoState: ParedaoStateSchema,
  votingStatus: VotingStatusSchema,
});
export type BBB26Export = z.infer<typeof BBB26ExportSchema>;

export const ParticipantsStatusExportSchema = z.object({
  version: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  participants: z.record(z.string(), z.object({
    status: ParticipantStatusSchema,
  })),
});
export type ParticipantsStatusExport = z.infer<typeof ParticipantsStatusExportSchema>;

export const ParedaoResultsExportSchema = z.object({
  version: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  paredoes: z.array(z.object({
    id: z.string().min(1),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    titulo: z.string().min(1),
    subtitulo: z.string().min(1),
    resultados: z.array(z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      media: z.number().positive(),
      status: ParedaoResultStatusSchema,
    })),
  })),
});
export type ParedaoResultsExport = z.infer<typeof ParedaoResultsExportSchema>;

// Tipos para atualização manual de seguidores

// Item do histórico de seguidores
export const FollowerHistoryItemSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // formato YYYY-MM-DD
  followers: z.number().int().min(0),
  source: z.string().optional(), // origem dos dados
  notes: z.string().optional(), // contexto da atualização
});
export type FollowerHistoryItem = z.infer<typeof FollowerHistoryItemSchema>;

// Participante com dados de seguidores
export const ParticipantFollowersSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  active: z.boolean(),
  eliminated: z.boolean().optional(), // se foi eliminado do programa
  instagram: z.string().optional(), // @handle do Instagram
  followersStart: z.number().int().min(0),
  followersCurrent: z.number().int().min(0),
  history: z.array(FollowerHistoryItemSchema),
});
export type ParticipantFollowers = z.infer<typeof ParticipantFollowersSchema>;

// Estrutura completa de atualização manual de seguidores
export const ParticipantsFollowersUpdateSchema = z.object({
  version: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  season: z.string().min(1),
  participants: z.array(ParticipantFollowersSchema),
});
export type ParticipantsFollowersUpdate = z.infer<typeof ParticipantsFollowersUpdateSchema>;

// Tipos para produtos da casa
export const ProductCategorySchema = z.enum([
  'cozinha',
  'cuidados-pessoais',
  'decoracao',
  'area-externa',
  'quarto',
  'sala'
]);
export type ProductCategory = z.infer<typeof ProductCategorySchema>;

// Loja virtual do produto (para badge no app)
export const ProductStoreSchema = z.enum(['mercadolivre', 'shopee']);
export type ProductStore = z.infer<typeof ProductStoreSchema>;

export const AdminProductSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  category: ProductCategorySchema.optional(),
  imageUrl: z.string().url(),
  affiliateUrl: z.string().url(),
  store: ProductStoreSchema.optional(),
  participantId: z.string().optional(),
  featured: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AdminProduct = z.infer<typeof AdminProductSchema>;

export const ProductsJsonPayloadSchema = z.object({
  version: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  season: z.string().min(1),
  products: z.array(AdminProductSchema),
});
export type ProductsJsonPayload = z.infer<typeof ProductsJsonPayloadSchema>;