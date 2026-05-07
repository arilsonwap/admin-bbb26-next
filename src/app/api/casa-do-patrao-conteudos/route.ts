import { NextResponse } from 'next/server';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { load } from 'cheerio';

const SOURCE_URL = 'https://record.r7.com/casa-do-patrao/';

type ContentType = 'noticia' | 'video' | 'foto';

type ContentItem = {
  title: string;
  href: string;
  imageUrl?: string;
  type: ContentType;
  category?: string;
  time?: string;
};

type Counts = Record<ContentType, number>;

function cleanText(input: string): string {
  return (input || '').replace(/\s+/g, ' ').trim();
}

function normalizeHref(href: string): string {
  const h = (href || '').trim();
  if (!h) return h;
  try {
    return new URL(h, SOURCE_URL).toString();
  } catch {
    return h;
  }
}

function normalizeImageUrl(url: string): string {
  const cleaned = (url || '').trim();
  if (!cleaned) return cleaned;
  try {
    return new URL(cleaned, SOURCE_URL).toString();
  } catch {
    return cleaned;
  }
}

function pickFirstUrlFromSrcset(srcset: string): string | undefined {
  const s = (srcset || '').trim();
  if (!s) return undefined;
  const first = s.split(',')[0]?.trim();
  const urlOnly = first?.split(/\s+/)[0]?.trim();
  return urlOnly || undefined;
}

function inferTypeFromHref(href: string): ContentType | null {
  if (/\/videos?\//i.test(href)) return 'video';
  if (href.includes('/novidades/fotos/')) return 'foto';
  if (href.includes('/casa-do-patrao/novidades/')) return 'noticia';
  return null;
}

function isIndexPath(href: string): boolean {
  try {
    const u = new URL(href);
    const p = u.pathname.replace(/\/+$/, '');
    return (
      p === '/casa-do-patrao' ||
      p === '/casa-do-patrao/novidades' ||
      p === '/casa-do-patrao/videos' ||
      p === '/casa-do-patrao/fotos'
    );
  } catch {
    return false;
  }
}

function emptyCounts(): Counts {
  return { noticia: 0, video: 0, foto: 0 };
}

function computeCounts(items: ContentItem[]): Counts {
  const c = emptyCounts();
  for (const it of items) c[it.type] += 1;
  return c;
}

function extractCasaDoPatraoConteudos(html: string): ContentItem[] {
  const $ = load(html);
  const items: ContentItem[] = [];
  const byHref = new Map<string, ContentItem>();

  function extractCategoryTime($root: cheerio.Cheerio) {
    const text = cleanText($root.text());
    const m = text.match(
      /\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{2,})\s*\/\s*(HÁ\s+\d+\s+(?:MINUTOS?|HORAS?|DIAS?)|ONTEM|\d{2}\/\d{2}\/\d{4})\b/i,
    );
    if (!m) return {};
    return {
      category: cleanText(m[1]).toUpperCase(),
      time: cleanText(m[2]).toUpperCase(),
    };
  }

  function bestContainer($a: cheerio.Cheerio) {
    const maxUp = 8;
    let cur = $a;
    for (let i = 0; i < maxUp; i += 1) {
      const p = cur.parent();
      if (!p || !p.length) break;
      const tag = String((p.get(0) as unknown as { tagName?: string })?.tagName ?? '').toLowerCase();
      if (tag === 'body' || tag === 'main') break;
      const hasImg = p.find('img').length > 0;
      const hasHeading = p.find('h2,h3,h4').length > 0;
      const hasLink = p.find('a').length > 0;
      if (hasLink && (hasImg || hasHeading)) return p;
      cur = p;
    }
    const fallback = $a.closest('article,li,div');
    return fallback.length ? fallback : $a.parent();
  }

  $('a[href]').each((_, el) => {
    const $a = $(el);
    const href = normalizeHref($a.attr('href') || '');
    if (!href) return;
    if (!href.includes('/casa-do-patrao/')) return;

    const type = inferTypeFromHref(href);
    if (!type) return;
    if (isIndexPath(href)) return;

    const $root = bestContainer($a);

    const titleFromSpan = cleanText($root.find('h3[data-tb-title="true"] a span').first().text());
    const titleFromH3Tb = cleanText($root.find('h3[data-tb-title="true"]').first().text());
    const titleFromHeading = cleanText($root.find('h2,h3,h4').first().text());
    const titleFromLinkText = cleanText($a.text());
    const titleFromAttr = cleanText($a.attr('title') || '');
    let title = titleFromSpan || titleFromH3Tb || titleFromHeading || titleFromLinkText || titleFromAttr;

    // remove prefixos meta se vierem colados no título
    title = title
      .replace(
        /^([A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{2,})\s*\/\s*(HÁ\s+\d+\s+(?:MINUTOS?|HORAS?|DIAS?)|ONTEM|\d{2}\/\d{2}\/\d{4})\s*[-–•]?\s*/i,
        '',
      )
      .trim();
    if (!title) return;

    const $img =
      $root.find('img.c-image').first().length
        ? $root.find('img.c-image').first()
        : $root.find('img').first();
    let imageUrl: string | undefined;
    if ($img.length) {
      const src =
        ($img.attr('src') || '').trim() ||
        ($img.attr('data-src') || '').trim() ||
        ($img.attr('data-lazy') || '').trim();
      const srcset =
        ($img.attr('srcset') || '').trim() || ($img.attr('data-srcset') || '').trim();
      imageUrl = src ? normalizeImageUrl(src) : undefined;
      if (!imageUrl) {
        const first = pickFirstUrlFromSrcset(srcset);
        if (first) imageUrl = normalizeImageUrl(first);
      }
    }

    const next: ContentItem = {
      title,
      href,
      imageUrl,
      type,
      ...extractCategoryTime($root),
    };

    const existing = byHref.get(href);
    if (!existing) {
      byHref.set(href, next);
      items.push(next);
      return;
    }

    // Mesmo href pode aparecer em múltiplos blocos; preferir título mais longo.
    if ((next.title || '').length > (existing.title || '').length) {
      byHref.set(href, next);
      const idx = items.findIndex((it) => it.href === href);
      if (idx >= 0) items[idx] = { ...existing, ...next };
    }
  });

  return items;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const readOnly = url.searchParams.get('read') === '1';
    const fetchedAt = new Date().toISOString();

    const outDir = path.join(process.cwd(), 'tools', 'bbb-hosting', 'public');
    await mkdir(outDir, { recursive: true });

    const mainFileName = 'casa-do-patrao-conteudos.json';
    const mainPath = path.join(outDir, mainFileName);

    type StoredPayload = {
      source?: string;
      fetchedAt?: string | null;
      lastAddedCount?: number;
      counts?: Partial<Counts>;
      items?: Array<ContentItem>;
    };

    let existingItems: ContentItem[] = [];
    let existingFetchedAt: string | null | undefined;
    let existingLastAddedCount: number | undefined;
    let existingCounts: Partial<Counts> | undefined;
    let hasSavedFile = false;
    try {
      const raw = await readFile(mainPath, 'utf8');
      const parsed = JSON.parse(raw) as StoredPayload;
      hasSavedFile = true;
      if (Array.isArray(parsed.items)) existingItems = parsed.items;
      if (typeof parsed.fetchedAt === 'string' || parsed.fetchedAt === null) existingFetchedAt = parsed.fetchedAt;
      if (typeof parsed.lastAddedCount === 'number') existingLastAddedCount = parsed.lastAddedCount;
      if (parsed.counts && typeof parsed.counts === 'object') existingCounts = parsed.counts;
    } catch {
      // primeira execução: arquivo pode não existir
    }

    if (readOnly) {
      const countsFromSaved = existingCounts;
      const countsAreValid =
        !!countsFromSaved &&
        typeof countsFromSaved.noticia === 'number' &&
        typeof countsFromSaved.video === 'number' &&
        typeof countsFromSaved.foto === 'number';
      return NextResponse.json({
        source: 'casa-do-patrao-conteudos',
        fetchedAt: existingFetchedAt ?? null,
        lastAddedCount: hasSavedFile ? (existingLastAddedCount ?? 0) : 0,
        counts: countsAreValid ? (countsFromSaved as Counts) : computeCounts(existingItems),
        items: existingItems,
      });
    }

    const res = await fetch(SOURCE_URL, {
      cache: 'no-store',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; AdminBBB26/1.0; +https://record.r7.com)',
        accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Falha ao buscar fonte (${res.status})` }, { status: 502 });
    }

    const html = await res.text();
    const incoming = extractCasaDoPatraoConteudos(html);

    const merged: ContentItem[] = [];
    const seenHref = new Set<string>();
    const existingHref = new Set(existingItems.map((it) => it.href).filter(Boolean));
    let addedCount = 0;

    for (const it of incoming) {
      if (!it.href || seenHref.has(it.href)) continue;
      seenHref.add(it.href);
      merged.push(it);
      if (!existingHref.has(it.href)) addedCount += 1;
    }
    for (const it of existingItems) {
      if (!it?.href || seenHref.has(it.href)) continue;
      seenHref.add(it.href);
      merged.push(it);
    }

    const limited = merged.slice(0, 100);
    const payload = {
      source: 'casa-do-patrao-conteudos',
      fetchedAt,
      lastAddedCount: addedCount,
      items: limited,
      counts: computeCounts(limited),
    };

    const mainJson = JSON.stringify(payload, null, 2);
    await writeFile(mainPath, mainJson, 'utf8');

    const latest = {
      file: mainFileName,
      lastModified: fetchedAt,
      localDate: new Date().toLocaleDateString('sv-SE'),
      bytes: Buffer.byteLength(mainJson, 'utf8'),
      sourceUrl: SOURCE_URL,
    };
    await writeFile(
      path.join(outDir, 'casa-do-patrao-conteudos-latest.json'),
      JSON.stringify(latest, null, 2),
      'utf8',
    );

    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro inesperado' },
      { status: 500 },
    );
  }
}

