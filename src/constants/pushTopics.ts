/**
 * Tópicos FCM / preferências — fonte única para painel e alinhamento futuro ao app.
 * Nomes compatíveis com FCM topic naming (ASCII).
 */
export const PUSH_TOPIC_SLUGS = [
  'news',
  'polls',
  'paredao',
  'events',
  'general',
] as const;

export type PushTopicSlug = (typeof PUSH_TOPIC_SLUGS)[number];

export const PUSH_TOPIC_LABELS: Record<PushTopicSlug, string> = {
  news: 'Notícias',
  polls: 'Enquetes',
  paredao: 'Paredão',
  events: 'Eventos / dinâmicas',
  general: 'Geral',
};
