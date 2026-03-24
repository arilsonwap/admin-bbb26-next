import { NextResponse } from 'next/server';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

const SOURCE_URL = 'https://gshow.globo.com/realities/bbb/bbb-26/';

type NewsItem = {
  title: string;
  href: string;
  time?: string;
  imageUrl?: string;
};

function normalizeHref(href: string): string {
  const h = (href || '').trim();
  if (!h) return h;
  if (h.startsWith('http://') || h.startsWith('https://')) return h;
  if (h.startsWith('//')) return `https:${h}`;
  if (h.startsWith('/')) return `https://gshow.globo.com${h}`;
  return h;
}

function normalizeImageUrl(url: string): string {
  const cleaned = (url || '').trim();
  if (!cleaned) return cleaned;
  return normalizeHref(cleaned);
}

function stripTags(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractImageUrlFromAnchorInner(innerHtml: string): string | undefined {
  // tenta pegar src / data-src / data-srcset do primeiro <img>
  const imgTagMatch = innerHtml.match(/<img\b[^>]*>/i);
  if (!imgTagMatch) return undefined;

  const imgTag = imgTagMatch[0];
  const src =
    imgTag.match(/\bsrc="([^"]+)"/i)?.[1] ??
    imgTag.match(/\bdata-src="([^"]+)"/i)?.[1] ??
    imgTag.match(/\bdata-original="([^"]+)"/i)?.[1];

  if (src) return normalizeImageUrl(src);

  const srcset =
    imgTag.match(/\bsrcset="([^"]+)"/i)?.[1] ??
    imgTag.match(/\bdata-srcset="([^"]+)"/i)?.[1];
  if (!srcset) return undefined;

  // pega o primeiro URL do srcset (antes do descritor)
  const first = srcset.split(',')[0]?.trim();
  const urlOnly = first?.split(/\s+/)[0]?.trim();
  if (!urlOnly) return undefined;
  return normalizeImageUrl(urlOnly);
}

function extractLatestNews(html: string): NewsItem[] {
  // Heurística: captura links no bloco "Últimas notícias" quando o HTML contiver esse título.
  // Mantemos sem dependências (cheerio) pra não mudar deps.
  const lower = html.toLowerCase();
  const marker = 'últimas notícias';
  const idx = lower.indexOf(marker);
  const slice = idx >= 0 ? html.slice(Math.max(0, idx - 10_000), idx + 60_000) : html;

  const items: NewsItem[] = [];
  const seen = new Set<string>();
  const imagesByHref = new Map<string, string>();
  const itemIndexByHref = new Map<string, number>();

  // href entre aspas duplas ou simples (o HTML do hub pode variar)
  const anchorRe =
    /<a\b[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(slice)) && items.length < 30) {
    const hrefRaw = (m[1] ?? m[2] ?? '').trim();
    const href = normalizeHref(hrefRaw);
    if (!href || !href.includes('gshow.globo.com')) continue;
    if (href.includes('/realities/bbb/bbb-26/') === false) continue;
    if (href.includes('#')) continue;
    if (/\/videos?\//i.test(href) || /\/video\//i.test(href)) continue;

    const inner = m[3] ?? '';

    // As imagens do feed geralmente ficam em outro <a> (figure-link) com o mesmo href.
    // Captura a imagem mesmo que esse anchor não tenha "título" legível.
    if (/<img\b/i.test(inner)) {
      const imageOnly = extractImageUrlFromAnchorInner(inner);
      if (imageOnly) {
        imagesByHref.set(href, imageOnly);
        const existingIdx = itemIndexByHref.get(href);
        if (existingIdx !== undefined) {
          items[existingIdx] = { ...items[existingIdx], imageUrl: imageOnly };
        }
      }
      continue;
    }

    const title = stripTags(inner);
    if (!title || title.length < 12) continue;
    if (/^mostrar mais$/i.test(title)) continue;
    if (/menu|buscar|entrar com conta globo|minha conta/i.test(title)) continue;
    if (/assista aos vídeos mais recentes do bbb\s*26/i.test(title)) continue;
    if (/^\s*vídeos?\s*$/i.test(title)) continue;
    if (/bbb\s*26:\s*veja a reação dos participantes após eliminação de breno/i.test(title)) continue;

    // tenta achar um "Há X" próximo no conteúdo do link
    const timeMatch = inner.match(/Há\s+\d+\s+(minutos?|horas?|dias?|meses?)/i);
    const time = timeMatch ? timeMatch[0].trim() : undefined;
    const imageUrl = imagesByHref.get(href) ?? extractImageUrlFromAnchorInner(inner);

    const key = `${href}::${title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    itemIndexByHref.set(href, items.length);
    items.push({ title, href, time, imageUrl });
  }

  return items;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const readOnly = url.searchParams.get('read') === '1';

    const fetchedAt = new Date().toISOString();

    const outDir = path.join(process.cwd(), 'tools', 'bbb-hosting', 'public');
    await mkdir(outDir, { recursive: true });
    const mainFileName = 'noticiasbbb.json';
    const mainPath = path.join(outDir, mainFileName);

    type StoredPayload = {
      source?: string;
      fetchedAt?: string;
      lastAddedCount?: number;
      items?: Array<{ title: string; href: string; imageUrl?: string }>;
    };

    let existingItems: Array<{ title: string; href: string; imageUrl?: string }> = [];
    let existingFetchedAt: string | undefined;
    let existingLastAddedCount: number | undefined;
    try {
      const raw = await readFile(mainPath, 'utf8');
      const parsed = JSON.parse(raw) as StoredPayload;
      if (Array.isArray(parsed.items)) existingItems = parsed.items;
      if (typeof parsed.fetchedAt === 'string') existingFetchedAt = parsed.fetchedAt;
      if (typeof parsed.lastAddedCount === 'number') existingLastAddedCount = parsed.lastAddedCount;
    } catch {
      // arquivo pode não existir na primeira execução
    }

    if (readOnly) {
      return NextResponse.json({
        ok: true,
        source: SOURCE_URL,
        count: existingItems.length,
        items: existingItems,
        fetchedAt: existingFetchedAt ?? fetchedAt,
        lastAddedCount: existingLastAddedCount ?? 0,
        savedTo: 'tools/bbb-hosting/public/noticiasbbb.json',
      });
    }

    const res = await fetch(SOURCE_URL, {
      // evita cache agressivo no edge/runtime
      cache: 'no-store',
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; AdminBBB26/1.0; +https://gshow.globo.com)',
        accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Falha ao buscar fonte (${res.status})` },
        { status: 502 },
      );
    }

    const html = await res.text();
    const items = extractLatestNews(html);

    const incomingItems = items.map((it) => ({
      title: it.title,
      href: it.href,
      imageUrl: it.imageUrl,
    }));

    const merged: Array<{ title: string; href: string; imageUrl?: string }> = [];
    const seenHref = new Set<string>();
    const existingHref = new Set(existingItems.map((it) => it.href).filter(Boolean));
    let addedCount = 0;

    // Novas primeiro (href vem do HTML atual do hub). Em seguida, reaproveita itens do JSON
    // antigo que não apareceram nesta extração — isso mantém histórico, mas pode preservar
    // URLs de matérias já removidas do ar (404) até serem empurradas fora do limite.
    for (const it of incomingItems) {
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
      source: 'noticiasbbb',
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
    };
    await writeFile(
      path.join(outDir, 'noticiasbbb-latest.json'),
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
      savedTo: 'tools/bbb-hosting/public/noticiasbbb.json',
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Erro inesperado' },
      { status: 500 },
    );
  }
}
