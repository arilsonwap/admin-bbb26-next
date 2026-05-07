/**
 * Export público de banners (contrato do app mobile).
 *
 * - **Fonte:** mesmos `BannerAdmin` do `banners-admin.json`; não há segundo store.
 * - **Filtro:** só entram banners `active`, dentro de `startsAt`/`endsAt` (se definidos), da `section` pedida.
 * - **Ordem:** `sortOrder` ascendente (alinhado ao admin após reorder).
 * - **Campos:** apenas id, imageUrl, targetUrl, sortOrder e metadados da raiz — sem title/subtitle/tags/notes.
 * - **`active` em cada item:** sempre `true` (itens inativos ou fora da janela não aparecem no array).
 *
 * Deve permanecer alinhado a `getPublicPayloadForSection` e a `writePublicExports` no store.
 */
import type { BannerAdmin, BannerPublicFile, BannerPublicItem } from '../models/bannersTypes';

function nowEligible(b: BannerAdmin, now: Date): boolean {
  if (!b.active) return false;
  if (b.startsAt) {
    const t = Date.parse(b.startsAt);
    if (!Number.isNaN(t) && now.getTime() < t) return false;
  }
  if (b.endsAt) {
    const t = Date.parse(b.endsAt);
    if (!Number.isNaN(t) && now.getTime() > t) return false;
  }
  return true;
}

export function toPublicFile(
  section: string,
  items: BannerAdmin[],
  updatedAtIso: string,
  now: Date = new Date()
): BannerPublicFile {
  const eligible = items
    .filter((b) => b.section === section && nowEligible(b, now))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const publicItems: BannerPublicItem[] = eligible.map((b) => ({
    id: b.id,
    imageUrl: b.imageUrl,
    targetUrl: b.targetUrl ?? null,
    active: true,
    sortOrder: b.sortOrder,
  }));

  return {
    section,
    updatedAt: updatedAtIso,
    items: publicItems,
  };
}
