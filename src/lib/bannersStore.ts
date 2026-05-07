import { mkdir, readFile, unlink, writeFile, access } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import type { z } from 'zod';
import { BannersAdminFileSchema } from '../models/bannersSchemas';
import type { BannerAdmin, BannerCreatePayload, BannerUpdatePayload } from '../models/bannersTypes';
import { toPublicFile } from './bannersPublic';
import { BANNERS_SECTION_DINAMICA } from '../constants/banners';
import { generateId } from '../utils/idUtils';

export { BANNERS_SECTION_DINAMICA };

type BannersAdminFile = z.infer<typeof BannersAdminFileSchema>;

function adminFilePath(): string {
  return join(process.cwd(), 'tools', 'bbb-hosting', 'public', 'content', 'banners-admin.json');
}

function lockFilePath(): string {
  return join(process.cwd(), 'banners-admin.lock');
}

function hostingContentDir(): string {
  return join(process.cwd(), 'tools', 'bbb-hosting', 'public', 'content');
}

function publicContentDir(): string {
  return join(process.cwd(), 'public', 'content');
}

function publicExportPath(section: string): string {
  return join(hostingContentDir(), `${section}-banners.json`);
}

function publicExportMirrorPath(section: string): string {
  return join(publicContentDir(), `${section}-banners.json`);
}

class FileLock {
  constructor(private readonly path: string) {}

  async acquire(timeoutMs = 8000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        await writeFile(this.path, `${Date.now()}`, { flag: 'wx' });
        return true;
      } catch {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    return false;
  }

  async release(): Promise<void> {
    try {
      await unlink(this.path);
    } catch {
      /* noop */
    }
  }
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await access(dir, constants.F_OK);
  } catch {
    await mkdir(dir, { recursive: true });
  }
}

function emptyStore(): BannersAdminFile {
  const now = new Date().toISOString();
  return {
    version: 1,
    updatedAt: now,
    sections: {
      [BANNERS_SECTION_DINAMICA]: { items: [] },
    },
  };
}

export async function readBannersAdminFile(): Promise<BannersAdminFile> {
  const path = adminFilePath();
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const data = BannersAdminFileSchema.safeParse(parsed);
    if (!data.success) {
      console.error('[banners] Schema inválido em banners-admin.json:', data.error.format());
      return emptyStore();
    }
    return data.data;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return emptyStore();
    throw e;
  }
}

async function writeBannersAdminFile(store: BannersAdminFile): Promise<void> {
  await ensureDir(hostingContentDir());
  await ensureDir(publicContentDir());
  const path = adminFilePath();
  const json = JSON.stringify(store, null, 2);
  await writeFile(path, json, 'utf8');
}

/**
 * Regenera **todas** as saídas `{section}-banners.json` a partir do store atual.
 * Chamado após create / update / delete / reorder (sempre após `writeBannersAdminFile`).
 * A rota `GET /api/public/banners/[section]` usa o mesmo `toPublicFile` via `getPublicPayloadForSection`.
 */
async function writePublicExports(store: BannersAdminFile): Promise<void> {
  const sectionKeys = Object.keys(store.sections);
  for (const section of sectionKeys) {
    const items = store.sections[section]?.items ?? [];
    const pub = toPublicFile(section, items, store.updatedAt);
    const json = JSON.stringify(pub, null, 2);
    await ensureDir(hostingContentDir());
    await ensureDir(publicContentDir());
    await writeFile(publicExportPath(section), json, 'utf8');
    await writeFile(publicExportMirrorPath(section), json, 'utf8');
  }
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const lock = new FileLock(lockFilePath());
  const ok = await lock.acquire();
  if (!ok) {
    throw new Error('Servidor ocupado: outra operação de banners está em andamento.');
  }
  try {
    return await fn();
  } finally {
    await lock.release();
  }
}

function normalizeUrlKey(url: string): string {
  return url.trim().toLowerCase();
}

function assertNoDuplicateImageUrl(
  section: string,
  items: BannerAdmin[],
  imageUrl: string,
  exceptId?: string
): void {
  const key = normalizeUrlKey(imageUrl);
  const dup = items.find(
    (b) => b.section === section && normalizeUrlKey(b.imageUrl) === key && b.id !== exceptId
  );
  if (dup) {
    throw new Error('Já existe um banner com a mesma URL de imagem nesta seção.');
  }
}

export async function listBannersBySection(section: string): Promise<BannerAdmin[]> {
  const store = await readBannersAdminFile();
  const items = store.sections[section]?.items ?? [];
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getBannerById(bannerId: string): Promise<BannerAdmin | null> {
  const store = await readBannersAdminFile();
  for (const sec of Object.values(store.sections)) {
    const found = sec.items.find((b) => b.id === bannerId);
    if (found) return found;
  }
  return null;
}

export async function createBanner(payload: BannerCreatePayload): Promise<BannerAdmin> {
  return withLock(async () => {
    const store = await readBannersAdminFile();
    if (!store.sections[payload.section]) {
      store.sections[payload.section] = { items: [] };
    }
    const items = store.sections[payload.section].items;
    assertNoDuplicateImageUrl(payload.section, items, payload.imageUrl);

    const now = new Date().toISOString();
    const maxOrder = items.reduce((m, b) => Math.max(m, b.sortOrder), 0);
    const sortOrder = payload.sortOrder ?? maxOrder + 1;

    const banner: BannerAdmin = {
      id: generateId('banner'),
      section: payload.section,
      title: payload.title ?? null,
      subtitle: payload.subtitle ?? null,
      imageUrl: payload.imageUrl,
      targetUrl: payload.targetUrl ?? null,
      active: payload.active,
      sortOrder,
      createdAt: now,
      updatedAt: now,
      startsAt: payload.startsAt ?? null,
      endsAt: payload.endsAt ?? null,
      tags: payload.tags,
      notes: payload.notes ?? null,
    };

    items.push(banner);
    store.updatedAt = now;
    await writeBannersAdminFile(store);
    await writePublicExports(store);
    return banner;
  });
}

export async function updateBanner(bannerId: string, payload: BannerUpdatePayload): Promise<BannerAdmin> {
  return withLock(async () => {
    const store = await readBannersAdminFile();
    const section = payload.section;
    if (!store.sections[section]) {
      throw new Error('Seção não encontrada');
    }
    const items = store.sections[section].items;
    const idx = items.findIndex((b) => b.id === bannerId);
    if (idx === -1) {
      throw new Error('Banner não encontrado');
    }
    const current = items[idx];
    const nextImage = payload.imageUrl ?? current.imageUrl;
    assertNoDuplicateImageUrl(section, items, nextImage, bannerId);

    const now = new Date().toISOString();
    const updated: BannerAdmin = {
      ...current,
      title: payload.title !== undefined ? payload.title : current.title,
      subtitle: payload.subtitle !== undefined ? payload.subtitle : current.subtitle,
      imageUrl: nextImage,
      targetUrl: payload.targetUrl !== undefined ? payload.targetUrl : current.targetUrl,
      active: payload.active !== undefined ? payload.active : current.active,
      sortOrder: payload.sortOrder !== undefined ? payload.sortOrder : current.sortOrder,
      startsAt: payload.startsAt !== undefined ? payload.startsAt : current.startsAt,
      endsAt: payload.endsAt !== undefined ? payload.endsAt : current.endsAt,
      tags: payload.tags !== undefined ? (payload.tags === null ? undefined : payload.tags) : current.tags,
      notes: payload.notes !== undefined ? payload.notes : current.notes,
      updatedAt: now,
    };

    items[idx] = updated;
    store.updatedAt = now;
    await writeBannersAdminFile(store);
    await writePublicExports(store);
    return updated;
  });
}

export async function deleteBanner(bannerId: string): Promise<void> {
  return withLock(async () => {
    const store = await readBannersAdminFile();
    let found = false;
    for (const sectionKey of Object.keys(store.sections)) {
      const items = store.sections[sectionKey].items;
      const next = items.filter((b) => b.id !== bannerId);
      if (next.length !== items.length) {
        store.sections[sectionKey].items = next;
        found = true;
        break;
      }
    }
    if (!found) {
      throw new Error('Banner não encontrado');
    }
    store.updatedAt = new Date().toISOString();
    await writeBannersAdminFile(store);
    await writePublicExports(store);
  });
}

export async function reorderBanners(section: string, orderedIds: string[]): Promise<BannerAdmin[]> {
  return withLock(async () => {
    const store = await readBannersAdminFile();
    if (!store.sections[section]) {
      throw new Error('Seção não encontrada');
    }
    const items = [...store.sections[section].items];
    if (orderedIds.length !== items.length) {
      throw new Error('Lista de IDs não corresponde aos banners da seção');
    }
    const idSet = new Set(items.map((b) => b.id));
    if (new Set(orderedIds).size !== orderedIds.length) {
      throw new Error('IDs duplicados na ordenação');
    }
    for (const id of orderedIds) {
      if (!idSet.has(id)) {
        throw new Error(`ID inválido na ordenação: ${id}`);
      }
    }
    const byId = new Map(items.map((b) => [b.id, b] as const));
    const now = new Date().toISOString();
    const reordered: BannerAdmin[] = orderedIds.map((id, index) => {
      const b = byId.get(id)!;
      return { ...b, sortOrder: index + 1, updatedAt: now };
    });
    store.sections[section].items = reordered;
    store.updatedAt = now;
    await writeBannersAdminFile(store);
    await writePublicExports(store);
    return reordered;
  });
}

/** Leitura pública: mesmo payload serializado em `{section}-banners.json` após a última gravação bem-sucedida. */
export async function getPublicPayloadForSection(section: string): Promise<ReturnType<typeof toPublicFile>> {
  const store = await readBannersAdminFile();
  const items = store.sections[section]?.items ?? [];
  return toPublicFile(section, items, store.updatedAt);
}
