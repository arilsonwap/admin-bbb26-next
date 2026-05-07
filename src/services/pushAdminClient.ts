import type { AdminSendPushPayload } from '../models/pushSchemas';
import type { PushNotificationLogRow } from '../models/pushTypes';

const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || 'admin-bbb26-dev-key';

export class PushAdminApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'PushAdminApiError';
  }
}

function adminHeaders(extra?: Record<string, string>) {
  return {
    'Content-Type': 'application/json',
    'x-api-key': ADMIN_API_KEY,
    ...extra,
  };
}

async function handleJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const o = body as {
      message?: string;
      error?: string;
      hint?: string;
      code?: string;
    } | null;
    const message =
      o?.hint ?? o?.message ?? o?.error ?? `Erro HTTP ${res.status}`;
    throw new PushAdminApiError(message, res.status, o?.code);
  }
  return body as T;
}

export async function sendAdminPush(
  payload: AdminSendPushPayload,
  options?: { adminLabel?: string }
): Promise<{
  logId: string;
  status: string;
  successCount: number;
  failureCount: number;
  errors: Array<{ index?: number; message: string }>;
  log: PushNotificationLogRow;
}> {
  const headers = adminHeaders(
    options?.adminLabel ? { 'x-admin-label': options.adminLabel } : undefined
  );
  const res = await fetch('/api/admin/notifications/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return handleJson(res);
}

export async function listPushNotificationLogs(limit = 50): Promise<{ logs: PushNotificationLogRow[] }> {
  const q = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`/api/admin/notifications/logs?${q.toString()}`, {
    method: 'GET',
    headers: adminHeaders(),
    cache: 'no-store',
  });
  return handleJson(res);
}
