import { z } from 'zod';

/** Alinhado ao contrato do app React Native BBB26. */
export type AppNotificationType =
  | 'news_new'
  | 'poll_new'
  | 'poll_result'
  | 'paredao_open'
  | 'paredao_result'
  | 'leader_proof'
  | 'angel_proof'
  | 'breaking_news';

export type AppPushData = {
  type: AppNotificationType;
  title?: string;
  body?: string;
  imageUrl?: string;
  targetScreen?: string;
  entityId?: string;
  url?: string;
};

export const AppNotificationTypeSchema = z.enum([
  'news_new',
  'poll_new',
  'poll_result',
  'paredao_open',
  'paredao_result',
  'leader_proof',
  'angel_proof',
  'breaking_news',
]);

export type PushPlatform = 'ios' | 'android' | 'web' | 'unknown';

export const PushPlatformSchema = z.enum(['ios', 'android', 'web', 'unknown']);

export type PushDeviceRow = {
  id: string;
  device_id: string;
  user_id: string | null;
  platform: PushPlatform;
  app_version: string | null;
  fcm_token: string;
  topics: string[];
  notifications_enabled: boolean;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

export type PushNotificationLogRow = {
  id: string;
  title: string | null;
  body: string | null;
  type: string;
  audience_type: 'token' | 'topic' | 'segment';
  audience_snapshot: Record<string, unknown>;
  payload_data: Record<string, unknown>;
  status: 'pending' | 'sent' | 'partial' | 'failed';
  provider: string;
  provider_response: Record<string, unknown> | null;
  success_count: number;
  failure_count: number;
  created_by: string | null;
  created_at: string;
};

/** Presets editoriais → type técnico (UI). */
export type EditorialPushPreset =
  | 'paredao_open'
  | 'angel_proof'
  | 'leader_proof'
  | 'angel_result'
  | 'leader_result'
  | 'monster_punishment'
  | 'elimination_result'
  | 'party_open'
  | 'dynamics_update'
  | 'poll_new'
  | 'news_new'
  | 'big_fone'
  | 'wall_formation'
  | 'save_or_immunity';

/** Editorial → `data.type` do schema (vários presets podem compartilhar o mesmo tipo). */
export const EDITORIAL_PRESET_TO_TYPE: Record<EditorialPushPreset, AppNotificationType> = {
  paredao_open: 'paredao_open',
  angel_proof: 'angel_proof',
  leader_proof: 'leader_proof',
  angel_result: 'angel_proof',
  leader_result: 'leader_proof',
  monster_punishment: 'breaking_news',
  elimination_result: 'paredao_result',
  party_open: 'news_new',
  dynamics_update: 'news_new',
  poll_new: 'poll_new',
  news_new: 'news_new',
  big_fone: 'breaking_news',
  wall_formation: 'paredao_open',
  save_or_immunity: 'angel_proof',
};

export const EDITORIAL_PRESET_LABELS: Record<EditorialPushPreset, string> = {
  paredao_open: 'Novo paredão',
  angel_proof: 'Prova do Anjo',
  leader_proof: 'Prova do Líder',
  angel_result: 'Anjo definido',
  leader_result: 'Líder definido',
  monster_punishment: 'Castigo do Monstro',
  elimination_result: 'Eliminação',
  party_open: 'Festa',
  dynamics_update: 'Dinâmica / jogo',
  poll_new: 'Enquete nova',
  news_new: 'Notícia / atualização',
  big_fone: 'Big Fone',
  wall_formation: 'Formação de paredão',
  save_or_immunity: 'Imunidade / salvamento',
};

/** Textos e campos opcionais padrão por tipo editorial (fonte única para o painel). */
export type EditorialPushFieldPreset = {
  title: string;
  body: string;
  targetScreen?: string;
  entityId?: string;
  url?: string;
  imageUrl?: string;
  auditLabel?: string;
};

export const EDITORIAL_PUSH_FIELD_PRESETS: Record<EditorialPushPreset, EditorialPushFieldPreset> = {
  paredao_open: {
    title: 'Novo paredão formado',
    body: 'Veja quem está na berlinda e acompanhe no app.',
  },
  angel_proof: {
    title: 'Prova do Anjo no ar',
    body: 'Confira a disputa e acompanhe tudo no app.',
  },
  leader_proof: {
    title: 'Prova do Líder no ar',
    body: 'Veja quem venceu e acompanhe no app.',
  },
  angel_result: {
    title: 'Anjo definido',
    body: 'Descubra quem venceu a prova no app.',
  },
  leader_result: {
    title: 'Líder definido',
    body: 'Veja quem assumiu a liderança no app.',
  },
  monster_punishment: {
    title: 'Castigo do Monstro definido',
    body: 'Veja quem caiu no castigo e acompanhe no app.',
  },
  elimination_result: {
    title: 'Eliminação definida',
    body: 'Veja quem deixou a casa e acompanhe no app.',
  },
  party_open: {
    title: 'Festa liberada',
    body: 'Veja os destaques da noite e acompanhe no app.',
  },
  dynamics_update: {
    title: 'Nova dinâmica no jogo',
    body: 'Entenda o que mudou e acompanhe no app.',
  },
  poll_new: {
    title: 'Nova enquete no ar',
    body: 'Vote agora e veja a opinião da torcida no app.',
  },
  news_new: {
    title: 'Nova atualização no BBB',
    body: 'Confira a novidade e acompanhe no app.',
  },
  big_fone: {
    title: 'Big Fone tocou',
    body: 'Veja o que aconteceu e acompanhe no app.',
  },
  wall_formation: {
    title: 'Formação de paredão',
    body: 'Confira como ficou a berlinda no app.',
  },
  save_or_immunity: {
    title: 'Imunidade definida',
    body: 'Veja quem escapou e acompanhe no app.',
  },
};
