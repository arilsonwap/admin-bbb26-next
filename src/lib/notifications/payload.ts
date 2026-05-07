import type { AppNotificationType, AppPushData } from '../../models/pushTypes';

/**
 * Converte o contrato do app em strings planas para `data` do FCM (somente strings).
 */
export function buildAppPushDataFromParts(input: {
  type: AppNotificationType;
  title?: string;
  body?: string;
  imageUrl?: string;
  targetScreen?: string;
  entityId?: string;
  url?: string;
}): AppPushData {
  return {
    type: input.type,
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.body !== undefined ? { body: input.body } : {}),
    ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
    ...(input.targetScreen !== undefined ? { targetScreen: input.targetScreen } : {}),
    ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
    ...(input.url !== undefined ? { url: input.url } : {}),
  };
}

const DATA_KEYS: (keyof AppPushData)[] = [
  'type',
  'title',
  'body',
  'imageUrl',
  'targetScreen',
  'entityId',
  'url',
];

export function serializeAppPushDataToFcm(data: AppPushData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of DATA_KEYS) {
    const v = data[key];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s.length === 0 && key !== 'type') continue;
    out[key] = key === 'type' ? String(data.type) : s;
  }
  if (!out.type) {
    out.type = data.type;
  }
  return out;
}
