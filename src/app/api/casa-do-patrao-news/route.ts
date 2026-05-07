import { NextResponse } from 'next/server';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { load } from 'cheerio';

const SOURCE_URL = 'https://record.r7.com/casa-do-patrao/';
const BASE_URL = 'https://record.r7.com';

type NewsItem = {
  title: string;
  href: string;
  imageUrl?: string;
  type?: 'novidade' | 'fotos';
};

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

function pickFirstUrlFromSrcset(srcset: string): string | undefined {
  const s = (srcset || '').trim();
  if (!s) return undefined;
  const first = s.split(',')[0]?.trim();
  const urlOnly = first?.split(/\s+/)[0]?.trim();
  return urlOnly || undefined;
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

function inferType(href: string): NewsItem['type'] | undefined {
  const h = href || '';
  if (h.includes('/novidades/fotos/')) return 'fotos';
  if (h.includes('/novidades/')) return 'novidade';
  return undefined;
}

function extractCasaDoPatraoNews(html: string): NewsItem[] {
  const $ = load(html);
  const items: NewsItem[] = [];
  const byHref = new Map<string, NewsItem>();

  function extractCategoryTime($root: cheerio.Cheerio) {
    const text = cleanText($root.text());
    const m = text.match(
      /\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{3,})\s*\/\s*(HÁ\s+\d+\s+(?:MINUTOS?|HORAS?|DIAS?)|ONTEM)\b/i,
    );
    if (!m) return {};
    return {
      category: cleanText(m[1]).toUpperCase(),
      time: cleanText(m[2]).toUpperCase(),
    };
  }

  function bestContainer($a: cheerio.Cheerio) {
    // Sobe poucos níveis procurando um container "card-like" (com img e/ou heading).
    // Não depender de <article>, pois a aba visual pode usar div/li.
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

  // Extrai por links candidatos (mais robusto do que depender apenas de <article>)
  $('a[href*="/casa-do-patrao/novidades/"]').each((_, el) => {
    const $a = $(el);

    const href = normalizeHref($a.attr('href') || '');
    if (!href) return;
    if (!href.includes('/casa-do-patrao/novidades/')) return;
    if (/\/videos?\//i.test(href)) return;

    // Ignorar o índice de listagem (/novidades/) que não é uma notícia em si
    try {
      const u = new URL(href);
      if (u.pathname === '/casa-do-patrao/novidades/' || u.pathname === '/casa-do-patrao/novidades') {
        return;
      }
    } catch {
      // ignore
    }

    const $root = bestContainer($a);

    const titleFromSpan = cleanText($root.find('h3[data-tb-title="true"] a span').first().text());
    const titleFromH3 = cleanText($root.find('h3[data-tb-title="true"]').first().text());
    const titleFromHeading = cleanText($root.find('h2,h3,h4').first().text());
    const titleFromLinkText = cleanText($a.text());
    const titleFromAttr = cleanText($a.attr('title') || '');
    let title = titleFromSpan || titleFromH3 || titleFromHeading || titleFromLinkText || titleFromAttr;
    // remove prefixo tipo "NOVIDADES / HÁ 2 HORAS" se vier colado no título
    title = title.replace(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{3,})\s*\/\s*(HÁ\s+[^\s].{0,20}|ONTEM)\s*[-–•]?\s*/i, '').trim();
    if (!title) return;

    let imageUrl: string | undefined;
    const $img =
      $root.find('img.c-image').first().length
        ? $root.find('img.c-image').first()
        : $root.find('img').first();
    if ($img.length) {
      const src =
        ($img.attr('src') || '').trim() ||
        ($img.attr('data-src') || '').trim() ||
        ($img.attr('data-lazy') || '').trim();

      const srcset =
        ($img.attr('srcset') || '').trim() ||
        // alguns HTMLs usam srcSet camelCase
        (($img.attr('srcSet') as unknown as string) || '').trim() ||
        ($img.attr('data-srcset') || '').trim();

      imageUrl = src ? normalizeImageUrl(src) : undefined;
      if (!imageUrl) {
        const first = pickFirstUrlFromSrcset(srcset);
        if (first) imageUrl = normalizeImageUrl(first);
      }
    }

    const next: NewsItem = {
      title,
      href,
      imageUrl,
      type: inferType(href),
      ...extractCategoryTime($root),
    };

    const existing = byHref.get(href);
    if (!existing) {
      byHref.set(href, next);
      items.push(next);
      return;
    }

    // Mesmo href pode aparecer em mais de um bloco (ex.: hero + aba notícias).
    // Preferimos o título mais informativo (mais longo).
    const existingLen = (existing.title || '').length;
    const nextLen = (next.title || '').length;
    if (nextLen > existingLen) {
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

    const mainFileName = 'casa-do-patrao-noticias.json';
    const mainPath = path.join(outDir, mainFileName);

    type StoredPayload = {
      source?: string;
      fetchedAt?: string | null;
      lastAddedCount?: number;
      items?: Array<NewsItem>;
    };

    let existingItems: NewsItem[] = [];
    let existingFetchedAt: string | null | undefined;
    let existingLastAddedCount: number | undefined;
    try {
      const raw = await readFile(mainPath, 'utf8');
      const parsed = JSON.parse(raw) as StoredPayload;
      if (Array.isArray(parsed.items)) existingItems = parsed.items;
      if (typeof parsed.fetchedAt === 'string' || parsed.fetchedAt === null) {
        existingFetchedAt = parsed.fetchedAt;
      }
      if (typeof parsed.lastAddedCount === 'number') existingLastAddedCount = parsed.lastAddedCount;
    } catch {
      // primeira execução: arquivo pode não existir
    }

    if (readOnly) {
      return NextResponse.json({
        ok: true,
        source: 'casa-do-patrao-news',
        count: existingItems.length,
        items: existingItems,
        fetchedAt: existingFetchedAt ?? null,
        lastAddedCount: existingLastAddedCount ?? 0,
        savedTo: 'tools/bbb-hosting/public/casa-do-patrao-noticias.json',
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
      return NextResponse.json({ ok: false, error: `Falha ao buscar fonte (${res.status})` }, { status: 502 });
    }

    const html = await res.text();
    const items = extractCasaDoPatraoNews(html);

    const merged: NewsItem[] = [];
    const seenHref = new Set<string>();
    const existingHref = new Set(existingItems.map((it) => it.href).filter(Boolean));
    let addedCount = 0;

    for (const it of items) {
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

    const limited = merged.slice(0, 50);

    const payload = {
      source: 'casa-do-patrao-news',
      fetchedAt,
      lastAddedCount: addedCount,
      items: limited,
    };

    const mainJson = JSON.stringify(payload, null, 2);
    await writeFile(mainPath, mainJson, 'utf8');

    const latest = {
      file: mainFileName,
      lastModified: fetchedAt,
      localDate: new Date().toLocaleDateString('sv-SE'),
      bytes: Buffer.byteLength(mainJson, 'utf8'),
      sourceUrl: SOURCE_URL,
      baseUrl: BASE_URL,
    };
    await writeFile(
      path.join(outDir, 'casa-do-patrao-noticias-latest.json'),
      JSON.stringify(latest, null, 2),
      'utf8',
    );

    return NextResponse.json({
      ok: true,
      source: SOURCE_URL,
      count: limited.length,
      items: limited,
      fetchedAt,
      lastAddedCount: addedCount,
      savedTo: 'tools/bbb-hosting/public/casa-do-patrao-noticias.json',
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Erro inesperado' },
      { status: 500 },
    );
  }
}

