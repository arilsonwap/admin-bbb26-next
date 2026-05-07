import type {
  PushDeviceRow,
  PushNotificationLogRow,
  PushPlatform,
} from '../models/pushTypes';

type SupabaseRestError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_ADMIN_KEY;

  if (!supabaseUrl) {
    throw new Error('Config Supabase ausente: defina SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL).');
  }

  if (!serviceRoleKey) {
    throw new Error('Config Supabase ausente: defina SUPABASE_SERVICE_ROLE_KEY (ou equivalente).');
  }

  return { supabaseUrl, serviceRoleKey };
}

async function supabaseFetch<T>(pathWithQuery: string, init: RequestInit): Promise<T> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();

  const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1${pathWithQuery}`;
  const hasBody = init.body !== undefined && init.body !== null;
  const res = await fetch(url, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  const data = (await res.json().catch(() => null)) as T | SupabaseRestError | null;

  if (!res.ok) {
    const err = data as SupabaseRestError | null;
    throw new Error(err?.message || `Erro Supabase REST HTTP ${res.status}`);
  }

  return data as T;
}

function normalizeDeviceRow(r: Record<string, unknown>): PushDeviceRow {
  const topicsRaw = r.topics;
  const topics = Array.isArray(topicsRaw) ? topicsRaw.map((t) => String(t)) : [];

  return {
    id: String(r.id),
    device_id: String(r.device_id ?? ''),
    user_id: r.user_id != null ? String(r.user_id) : null,
    platform: (r.platform as PushPlatform) || 'unknown',
    app_version: r.app_version != null ? String(r.app_version) : null,
    fcm_token: String(r.fcm_token ?? ''),
    topics,
    notifications_enabled: r.notifications_enabled !== false,
    last_seen_at: String(r.last_seen_at ?? new Date().toISOString()),
    created_at: String(r.created_at ?? new Date().toISOString()),
    updated_at: String(r.updated_at ?? new Date().toISOString()),
  };
}

export type RegisterDeviceInput = {
  deviceId: string;
  platform: PushPlatform;
  appVersion?: string;
  fcmToken: string;
  topics: string[];
  notificationsEnabled: boolean;
  userId?: string | null;
};

/**
 * Upsert idempotente por `device_id` (atualiza token e metadados).
 */
export async function upsertPushDevice(input: RegisterDeviceInput): Promise<PushDeviceRow> {
  const now = new Date().toISOString();
  const body = {
    device_id: input.deviceId,
    user_id: input.userId ?? null,
    platform: input.platform,
    app_version: input.appVersion ?? null,
    fcm_token: input.fcmToken,
    topics: input.topics,
    notifications_enabled: input.notificationsEnabled,
    last_seen_at: now,
    updated_at: now,
  };

  const rows = await supabaseFetch<Record<string, unknown>[]>('/push_devices?on_conflict=device_id', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation,resolution=merge-duplicates',
    },
    body: JSON.stringify(body),
  });

  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row || typeof row !== 'object') {
    throw new Error('Resposta inválida ao registrar dispositivo.');
  }
  return normalizeDeviceRow(row as Record<string, unknown>);
}

export type SegmentFilter = {
  platform?: PushPlatform;
  /** Pelo menos um tópico em comum (overlap). */
  topics?: string[];
};

/**
 * Plataforma registrada para o token (ex.: envio data-only no Android).
 */
export async function getPushDevicePlatformByFcmToken(token: string): Promise<PushPlatform | null> {
  const t = token.trim();
  if (!t) return null;
  const params = new URLSearchParams();
  params.set('select', 'platform');
  params.set('fcm_token', `eq.${encodeURIComponent(t)}`);
  params.set('limit', '1');
  const rows = await supabaseFetch<Array<{ platform: PushPlatform }>>(
    `/push_devices?${params.toString()}`,
    { method: 'GET' }
  );
  const row = Array.isArray(rows) ? rows[0] : undefined;
  return row?.platform ?? null;
}

/**
 * Lista dispositivos FCM para segmentação (notificações habilitadas, token não vazio).
 */
export async function listFcmDevicesForSegment(
  filter: SegmentFilter
): Promise<Array<{ fcm_token: string; platform: PushPlatform }>> {
  const params = new URLSearchParams();
  params.set('select', 'fcm_token,platform');
  params.set('notifications_enabled', 'eq.true');
  params.set('fcm_token', 'not.is.null');

  if (filter.platform) {
    params.set('platform', `eq.${filter.platform}`);
  }

  if (filter.topics && filter.topics.length > 0) {
    params.set('topics', `ov.{${filter.topics.join(',')}}`);
  }

  params.set('limit', '5000');

  const rows = await supabaseFetch<Array<{ fcm_token: string; platform: PushPlatform }>>(
    `/push_devices?${params.toString()}`,
    { method: 'GET' }
  );

  const list = Array.isArray(rows) ? rows : [];
  const byToken = new Map<string, PushPlatform>();
  for (const r of list) {
    const tok = r.fcm_token?.trim();
    if (!tok) continue;
    if (!byToken.has(tok)) {
      byToken.set(tok, r.platform ?? 'unknown');
    }
  }
  return Array.from(byToken.entries()).map(([fcm_token, platform]) => ({ fcm_token, platform }));
}

export type InsertPushLogInput = {
  title: string | null;
  body: string | null;
  type: string;
  audienceType: 'token' | 'topic' | 'segment';
  audienceSnapshot: Record<string, unknown>;
  payloadData: Record<string, unknown>;
  status: 'pending' | 'sent' | 'partial' | 'failed';
  provider?: string;
  providerResponse?: unknown;
  successCount: number;
  failureCount: number;
  createdBy?: string | null;
};

export async function insertPushNotificationLog(input: InsertPushLogInput): Promise<PushNotificationLogRow> {
  const body = {
    title: input.title,
    body: input.body,
    type: input.type,
    audience_type: input.audienceType,
    audience_snapshot: input.audienceSnapshot,
    payload_data: input.payloadData,
    status: input.status,
    provider: input.provider ?? 'fcm',
    provider_response: input.providerResponse ?? null,
    success_count: input.successCount,
    failure_count: input.failureCount,
    created_by: input.createdBy ?? null,
  };

  const rows = await supabaseFetch<Record<string, unknown>[]>('/push_notification_logs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });

  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row || typeof row !== 'object') {
    throw new Error('Resposta inválida ao gravar log de push.');
  }
  return normalizeLogRow(row as Record<string, unknown>);
}

function normalizeLogRow(r: Record<string, unknown>): PushNotificationLogRow {
  return {
    id: String(r.id),
    title: r.title != null ? String(r.title) : null,
    body: r.body != null ? String(r.body) : null,
    type: String(r.type ?? ''),
    audience_type: r.audience_type as PushNotificationLogRow['audience_type'],
    audience_snapshot: (r.audience_snapshot as Record<string, unknown>) ?? {},
    payload_data: (r.payload_data as Record<string, unknown>) ?? {},
    status: r.status as PushNotificationLogRow['status'],
    provider: String(r.provider ?? 'fcm'),
    provider_response: (r.provider_response as Record<string, unknown> | null) ?? null,
    success_count: Number(r.success_count ?? 0),
    failure_count: Number(r.failure_count ?? 0),
    created_by: r.created_by != null ? String(r.created_by) : null,
    created_at: String(r.created_at ?? new Date().toISOString()),
  };
}

export async function listRecentPushNotificationLogs(limit = 50): Promise<PushNotificationLogRow[]> {
  const q = new URLSearchParams({
    select: '*',
    order: 'created_at.desc',
    limit: String(Math.min(Math.max(limit, 1), 200)),
  });
  const rows = await supabaseFetch<Record<string, unknown>[]>(`/push_notification_logs?${q.toString()}`, {
    method: 'GET',
  });
  const list = Array.isArray(rows) ? rows : [];
  return list.map((r) => normalizeLogRow(r));
}
