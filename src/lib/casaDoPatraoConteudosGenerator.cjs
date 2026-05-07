const { mkdir, readFile, writeFile } = require('fs/promises');
const path = require('path');
const { load } = require('cheerio');

const SOURCE_URL = 'https://record.r7.com/casa-do-patrao/';
const MAIN_FILE_NAME = 'casa-do-patrao-conteudos.json';
const LATEST_FILE_NAME = 'casa-do-patrao-conteudos-latest.json';

function cleanText(input) {
  return (input || '').replace(/\s+/g, ' ').trim();
}

function normalizeHref(href) {
  const h = (href || '').trim();
  if (!h) return h;
  try {
    return new URL(h, SOURCE_URL).toString();
  } catch {
    return h;
  }
}

function normalizeImageUrl(url) {
  const cleaned = (url || '').trim();
  if (!cleaned) return cleaned;
  try {
    return new URL(cleaned, SOURCE_URL).toString();
  } catch {
    return cleaned;
  }
}

function pickFirstUrlFromSrcset(srcset) {
  const s = (srcset || '').trim();
  if (!s) return undefined;
  const first = s.split(',')[0]?.trim();
  const urlOnly = first?.split(/\s+/)[0]?.trim();
  return urlOnly || undefined;
}

function inferTypeFromHref(href) {
  if (/\/videos?\//i.test(href)) return 'video';
  if (href.includes('/novidades/fotos/')) return 'foto';
  if (href.includes('/casa-do-patrao/novidades/')) return 'noticia';
  return null;
}

function isIndexPath(href) {
  try {
    const u = new URL(href);
    const p = u.pathname.replace(/\/+$/, '');
    return p === '/casa-do-patrao' || p === '/casa-do-patrao/novidades' || p === '/casa-do-patrao/videos' || p === '/casa-do-patrao/fotos';
  } catch {
    return false;
  }
}

function computeCounts(items) {
  const counts = { noticia: 0, video: 0, foto: 0 };
  for (const it of items) counts[it.type] += 1;
  return counts;
}

function extractCasaDoPatraoConteudos(html) {
  const $ = load(html);
  const items = [];
  const byHref = new Map();

  function extractCategoryTime($root) {
    const text = cleanText($root.text());
    const m = text.match(/\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{2,})\s*\/\s*(HÁ\s+\d+\s+(?:MINUTOS?|HORAS?|DIAS?)|ONTEM|\d{2}\/\d{2}\/\d{4})\b/i);
    if (!m) return {};
    return { category: cleanText(m[1]).toUpperCase(), time: cleanText(m[2]).toUpperCase() };
  }

  function bestContainer($a) {
    let cur = $a;
    for (let i = 0; i < 8; i += 1) {
      const p = cur.parent();
      if (!p || !p.length) break;
      const tag = String(p.get(0)?.tagName ?? '').toLowerCase();
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
    if (!href || !href.includes('/casa-do-patrao/')) return;
    const type = inferTypeFromHref(href);
    if (!type || isIndexPath(href)) return;

    const $root = bestContainer($a);
    let title = cleanText($root.find('h3[data-tb-title="true"] a span').first().text()) ||
      cleanText($root.find('h3[data-tb-title="true"]').first().text()) ||
      cleanText($root.find('h2,h3,h4').first().text()) ||
      cleanText($a.text()) ||
      cleanText($a.attr('title') || '');

    title = title.replace(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{2,})\s*\/\s*(HÁ\s+\d+\s+(?:MINUTOS?|HORAS?|DIAS?)|ONTEM|\d{2}\/\d{2}\/\d{4})\s*[-–•]?\s*/i, '').trim();
    if (!title) return;

    const $img = $root.find('img.c-image').first().length ? $root.find('img.c-image').first() : $root.find('img').first();
    let imageUrl;
    if ($img.length) {
      const src = ($img.attr('src') || '').trim() || ($img.attr('data-src') || '').trim() || ($img.attr('data-lazy') || '').trim();
      const srcset = ($img.attr('srcset') || '').trim() || ($img.attr('data-srcset') || '').trim();
      imageUrl = src ? normalizeImageUrl(src) : undefined;
      if (!imageUrl) {
        const first = pickFirstUrlFromSrcset(srcset);
        if (first) imageUrl = normalizeImageUrl(first);
      }
    }

    const next = { title, href, imageUrl, type, ...extractCategoryTime($root) };
    const existing = byHref.get(href);
    if (!existing) {
      byHref.set(href, next);
      items.push(next);
      return;
    }
    if ((next.title || '').length > (existing.title || '').length) {
      byHref.set(href, next);
      const idx = items.findIndex((it) => it.href === href);
      if (idx >= 0) items[idx] = { ...existing, ...next };
    }
  });

  return items;
}

async function loadSavedPayload(outDir) {
  const mainPath = path.join(outDir, MAIN_FILE_NAME);
  let existingItems = [];
  let existingFetchedAt;
  let existingLastAddedCount;
  let existingCounts;
  let hasSavedFile = false;

  try {
    const raw = await readFile(mainPath, 'utf8');
    const parsed = JSON.parse(raw);
    hasSavedFile = true;
    if (Array.isArray(parsed.items)) existingItems = parsed.items;
    if (typeof parsed.fetchedAt === 'string' || parsed.fetchedAt === null) existingFetchedAt = parsed.fetchedAt;
    if (typeof parsed.lastAddedCount === 'number') existingLastAddedCount = parsed.lastAddedCount;
    if (parsed.counts && typeof parsed.counts === 'object') existingCounts = parsed.counts;
  } catch {
    // no-op
  }

  return { mainPath, existingItems, existingFetchedAt, existingLastAddedCount, existingCounts, hasSavedFile };
}

async function readCasaDoPatraoConteudosSaved(baseDir = process.cwd()) {
  const outDir = path.join(baseDir, 'tools', 'bbb-hosting', 'public');
  await mkdir(outDir, { recursive: true });
  const saved = await loadSavedPayload(outDir);
  const countsAreValid = !!saved.existingCounts && typeof saved.existingCounts.noticia === 'number' && typeof saved.existingCounts.video === 'number' && typeof saved.existingCounts.foto === 'number';

  return {
    source: 'casa-do-patrao-conteudos',
    fetchedAt: saved.existingFetchedAt ?? null,
    lastAddedCount: saved.hasSavedFile ? (saved.existingLastAddedCount ?? 0) : 0,
    counts: countsAreValid ? saved.existingCounts : computeCounts(saved.existingItems),
    items: saved.existingItems,
  };
}

async function generateCasaDoPatraoConteudos(baseDir = process.cwd()) {
  const fetchedAt = new Date().toISOString();
  const outDir = path.join(baseDir, 'tools', 'bbb-hosting', 'public');
  await mkdir(outDir, { recursive: true });

  const saved = await loadSavedPayload(outDir);

  const res = await fetch(SOURCE_URL, {
    cache: 'no-store',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; AdminBBB26/1.0; +https://record.r7.com)',
      accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!res.ok) throw new Error(`Falha ao buscar fonte (${res.status})`);

  const incoming = extractCasaDoPatraoConteudos(await res.text());
  const merged = [];
  const seenHref = new Set();
  const existingHref = new Set(saved.existingItems.map((it) => it.href).filter(Boolean));
  let addedCount = 0;

  for (const it of incoming) {
    if (!it.href || seenHref.has(it.href)) continue;
    seenHref.add(it.href);
    merged.push(it);
    if (!existingHref.has(it.href)) addedCount += 1;
  }
  for (const it of saved.existingItems) {
    if (!it?.href || seenHref.has(it.href)) continue;
    seenHref.add(it.href);
    merged.push(it);
  }

  const limited = merged.slice(0, 100);
  const payload = { source: 'casa-do-patrao-conteudos', fetchedAt, lastAddedCount: addedCount, items: limited, counts: computeCounts(limited) };

  const mainJson = JSON.stringify(payload, null, 2);
  await writeFile(saved.mainPath, mainJson, 'utf8');

  const latest = { file: MAIN_FILE_NAME, lastModified: fetchedAt, localDate: new Date().toLocaleDateString('sv-SE'), bytes: Buffer.byteLength(mainJson, 'utf8'), sourceUrl: SOURCE_URL };
  await writeFile(path.join(outDir, LATEST_FILE_NAME), JSON.stringify(latest, null, 2), 'utf8');

  return { payload, incomingCount: incoming.length, mergedCount: merged.length, writtenCount: limited.length, addedCount };
}

module.exports = {
  readCasaDoPatraoConteudosSaved,
  generateCasaDoPatraoConteudos,
};
