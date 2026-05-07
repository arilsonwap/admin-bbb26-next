import type { BannerPublicFile } from '../../../models/bannersTypes';
import { BannerPublicFileSchema } from '../../../models/bannersSchemas';
import {
  BannersApiError,
  createBanner,
  deleteBanner,
  getBanner,
  listBanners,
  reorderBanners,
  updateBanner,
} from '../../../services/bannersAdminClient';

export {
  BannersApiError,
  createBanner,
  deleteBanner,
  getBanner,
  updateBanner,
  reorderBanners,
};

export const listBannersBySection = listBanners;

export async function getPublicPayloadForSection(section: string): Promise<BannerPublicFile> {
  const res = await fetch(`/api/public/banners/${encodeURIComponent(section)}`, {
    cache: 'no-store',
  });

  const text = await res.text();

  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new BannersApiError('Resposta inválida do servidor', res.status);
  }

  if (!res.ok) {
    const o = body as { error?: string } | null;
    throw new BannersApiError(o?.error ?? `Erro HTTP ${res.status}`, res.status);
  }

  const parsed = BannerPublicFileSchema.safeParse(body);
  if (!parsed.success) {
    throw new BannersApiError('Payload público de banners inválido', 500);
  }

  return parsed.data;
}
