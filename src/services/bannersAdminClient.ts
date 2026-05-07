import type {
  BannerAdmin,
  BannerCreatePayload,
  BannerReorderPayload,
  BannerUpdatePayload,
} from '../models/bannersTypes';

const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || 'admin-bbb26-dev-key';

export class BannersApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'BannersApiError';
  }
}

function adminHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-api-key': ADMIN_API_KEY,
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
    const o = body as { message?: string; error?: string } | null;
    const message = o?.message ?? o?.error ?? `Erro HTTP ${res.status}`;
    throw new BannersApiError(message, res.status);
  }
  return body as T;
}

export async function listBanners(section: string): Promise<BannerAdmin[]> {
  const q = new URLSearchParams({ section });
  const res = await fetch(`/api/admin/banners?${q.toString()}`, {
    method: 'GET',
    headers: adminHeaders(),
    cache: 'no-store',
  });
  return handleJson<BannerAdmin[]>(res);
}

export async function getBanner(bannerId: string): Promise<BannerAdmin> {
  const res = await fetch(`/api/admin/banners/${encodeURIComponent(bannerId)}`, {
    method: 'GET',
    headers: adminHeaders(),
    cache: 'no-store',
  });
  return handleJson<BannerAdmin>(res);
}

export async function createBanner(payload: BannerCreatePayload): Promise<BannerAdmin> {
  const res = await fetch('/api/admin/banners', {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  });
  return handleJson<BannerAdmin>(res);
}

export async function updateBanner(bannerId: string, payload: BannerUpdatePayload): Promise<BannerAdmin> {
  const res = await fetch(`/api/admin/banners/${encodeURIComponent(bannerId)}`, {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  });
  return handleJson<BannerAdmin>(res);
}

export async function deleteBanner(bannerId: string): Promise<void> {
  const res = await fetch(`/api/admin/banners/${encodeURIComponent(bannerId)}`, {
    method: 'DELETE',
    headers: adminHeaders(),
  });
  await handleJson<{ ok: boolean }>(res);
}

export async function reorderBanners(payload: BannerReorderPayload): Promise<BannerAdmin[]> {
  const res = await fetch('/api/admin/banners/reorder', {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  });
  return handleJson<BannerAdmin[]>(res);
}
