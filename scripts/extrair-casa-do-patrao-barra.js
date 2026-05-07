/* eslint-disable no-console */
/**
 * Extrai participantes da barra (.participant-bar__item + title).
 * Papel visível (Patrão, Poder do Voto, etc.) vem de .participant-bar__status quando existir.
 * Saída: { nome, funcao, funcaoSlug } → data/casa-do-patrao-participantes-barra.json
 */
const fs = require("node:fs/promises");
const path = require("node:path");
const cheerio = require("cheerio");

const PAGE_URL =
  process.env.CASA_DO_PATRAO_URL || "https://media.r7.com/r7/media/casa_do_patrao/index.html";

/** Itens da barra: lista oficial ou slide isolado (UI varia). */
const BAR_ITEM_SELECTOR =
  ".participant-bar__list .participant-bar__item, .swiper-slide.participant-bar__item, .participant-bar__item";
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  "data/casa-do-patrao-participantes-barra.json",
);
const OUTPUT_LATEST_PATH = path.resolve(
  process.cwd(),
  "data/casa-do-patrao-participantes-barra-latest.json",
);
const SOURCE_ID = "casa_do_patrao_r7_barra";

function cleanText(value) {
  if (!value) return "";
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFuncaoUpper(value) {
  const t = cleanText(value);
  if (!t) return "";
  return t.toLocaleUpperCase("pt-BR");
}

function toSlug(value) {
  const t = cleanText(value);
  if (!t) return "";
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function funcaoToSlug(funcaoUpper) {
  const f = cleanText(funcaoUpper);
  if (!f) return null;
  if (f === "PATRÃO") return "patrao";
  if (f === "PARÇA") return "parca";
  if (f === "PODER DO VOTO") return "poder-do-voto";
  if (f === "TÁ NA RETA" || f === "TA NA RETA") return "ta-na-reta";
  if (f === "TÁ NA RUA" || f === "TA NA RUA") return "ta-na-rua";
  const s = toSlug(f);
  return s || null;
}

function inferFuncaoLabelFromText(texto) {
  const t = cleanText(texto);
  if (!t) return null;
  if (/patrão|patrao/i.test(t)) return "Patrão";
  if (/capataz/i.test(t)) return "Capataz";
  if (/peão|peao/i.test(t)) return "Peão";
  if (/cozinha/i.test(t)) return "Cozinha";
  if (/parça|parca/i.test(t)) return "Parça";
  if (/celeiro/i.test(t)) return "Celeiro";
  if (/vip/i.test(t)) return "VIP";
  if (/líder|lider/i.test(t)) return "Líder";
  if (/poder\s+do\s+voto/i.test(t)) return "Poder do Voto";
  if (/t[aá]\s+na\s+rua/i.test(t)) return "Tá na Rua";
  if (/t[aá]\s+na\s+reta/i.test(t)) return "Tá na Reta";
  return null;
}

function rowFromNomeTexto(nomeRaw, textoExtra) {
  const nome = cleanText(nomeRaw);
  if (!nome) return null;

  const label = inferFuncaoLabelFromText(textoExtra);
  const funcao = label ? normalizeFuncaoUpper(label) : "";
  const funcaoSlug = funcao ? funcaoToSlug(funcao) : null;

  return { nome, funcao, funcaoSlug };
}

function parseBarFromCheerio(html) {
  const $ = cheerio.load(html);
  const rows = [];
  $(BAR_ITEM_SELECTOR).each((_, el) => {
    const $item = $(el);
    const nome =
      cleanText($item.attr("title")) ||
      cleanText($item.find("img").first().attr("alt")) ||
      cleanText($item.text());
    const statusBadge = cleanText($item.find(".participant-bar__status").first().text());
    if (statusBadge) {
      const funcao = normalizeFuncaoUpper(statusBadge);
      rows.push({
        nome,
        funcao,
        funcaoSlug: funcao ? funcaoToSlug(funcao) : null,
      });
      return;
    }
    const texto = cleanText($item.text());
    const row = rowFromNomeTexto(nome, texto);
    if (row) rows.push(row);
  });
  return dedupeParticipantes(rows);
}

function hasBarItems(html) {
  const $ = cheerio.load(html);
  return $(BAR_ITEM_SELECTOR).length > 0;
}

async function fetchHtmlSimple() {
  let res;
  try {
    res = await fetch(PAGE_URL, {
      method: "GET",
      headers: {
        "user-agent": "Mozilla/5.0 (Node.js) casa-do-patrao-barra-scraper",
        accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (err) {
    const e = new Error(`Erro ao acessar a página: falha de rede em ${PAGE_URL}`);
    e.cause = err;
    throw e;
  }

  if (!res.ok) {
    throw new Error(`Erro ao acessar a página: HTTP ${res.status} em ${PAGE_URL}`);
  }

  return await res.text();
}

function dedupeParticipantes(list) {
  const byNome = new Map();
  for (const p of list) {
    const key = p.nome.toLocaleLowerCase("pt-BR");
    const prev = byNome.get(key);
    if (!prev) {
      byNome.set(key, { ...p });
      continue;
    }
    const prefer = (a, b) => {
      const fa = a.funcao?.length ? 1 : 0;
      const fb = b.funcao?.length ? 1 : 0;
      if (fb > fa) return b;
      return a;
    };
    byNome.set(key, prefer(prev, p));
  }
  return Array.from(byNome.values());
}

async function waitForBarItems(page, { timeoutMs = 50_000, stepMs = 400 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const n = await page.evaluate((sel) => document.querySelectorAll(sel).length, BAR_ITEM_SELECTOR);
    if (n > 0) return n;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return 0;
}

async function extractBarWithPuppeteer() {
  let puppeteer;
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    puppeteer = require("puppeteer");
  } catch {
    throw new Error(
      "Instale o puppeteer (devDependency) para extrair a barra renderizada por JS: npm i -D puppeteer",
    );
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1365, height: 800, deviceScaleFactor: 1 });
    await page.setUserAgent(
      process.env.CASA_DO_PATRAO_UA ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
    await page.goto(PAGE_URL, { waitUntil: "networkidle2", timeout: 60_000 });

    const nBar = await waitForBarItems(page, { timeoutMs: 55_000 });
    if (nBar === 0) {
      const snap = await page.evaluate(() => ({
        barItem: document.querySelectorAll(".participant-bar__item").length,
        card: document.querySelectorAll(".participant-card").length,
      }));
      const hint =
        snap.card > 0 && snap.barItem === 0
          ? " Esta URL está com grid de cards (.participant-card). Use npm run scrape:casa-patrao."
          : "";
      throw new Error(
        `Nenhum item da barra (${BAR_ITEM_SELECTOR}) após espera.${hint} Opcional: CASA_DO_PATRAO_URL=... se a barra estiver em outra rota.`,
      );
    }

    const raw = await page.evaluate((itemSel) => {
      const ROLE_RE =
        /patrão|patrao|capataz|peão|peao|cozinha|celeiro|vip|líder|lider|parça|parca|poder\s+do\s+voto|t[aá]\s+na\s+rua|t[aá]\s+na\s+reta/i;

      function inferFromText(t) {
        const s = (t || "").replace(/\s+/g, " ").trim();
        if (!s) return "";
        if (/poder\s+do\s+voto/i.test(s)) return "PODER DO VOTO";
        if (/t[aá]\s+na\s+rua/i.test(s)) return "TÁ NA RUA";
        if (/t[aá]\s+na\s+reta/i.test(s)) return "TÁ NA RETA";
        if (/patrão|patrao/i.test(s)) return "PATRÃO";
        if (/capataz/i.test(s)) return "CAPATAZ";
        if (/peão|peao/i.test(s)) return "PEÃO";
        if (/cozinha/i.test(s)) return "COZINHA";
        if (/parça|parca/i.test(s)) return "PARÇA";
        if (/celeiro/i.test(s)) return "CELEIRO";
        if (/vip/i.test(s)) return "VIP";
        if (/líder|lider/i.test(s)) return "LÍDER";
        return "";
      }

      function guessFromPoint(item) {
        const rect = item.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = Math.min(rect.bottom + 14, window.innerHeight - 1);
        const stack = document.elementsFromPoint(x, y);
        for (const el of stack) {
          if (item === el || item.contains(el)) continue;
          const text = (el.innerText || "").split(/\n/)[0]?.trim() || "";
          if (!text || text.length > 40) continue;
          if (!ROLE_RE.test(text)) continue;
          const upper = inferFromText(text);
          if (upper) return upper;
        }
        return "";
      }

      const items = Array.from(document.querySelectorAll(itemSel));

      return items.map((item) => {
        const nome =
          item.getAttribute("title")?.trim() ||
          item.querySelector("img")?.getAttribute("alt")?.trim() ||
          (item.textContent || "").replace(/\s+/g, " ").trim() ||
          "";

        const statusEl = item.querySelector(".participant-bar__status");
        const statusText = (statusEl?.innerText || "").replace(/\s+/g, " ").trim();

        const texto = (item.innerText || "").replace(/\s+/g, " ").trim();
        let funcao = "";
        if (statusText) {
          funcao = statusText.toLocaleUpperCase("pt-BR");
        } else {
          funcao = inferFromText(texto);
          if (!funcao) funcao = guessFromPoint(item);
        }

        return { nome, funcao };
      });
    }, BAR_ITEM_SELECTOR);

    const rows = [];
    for (const r of raw) {
      const nome = cleanText(r.nome);
      if (!nome) continue;
      const funcaoRaw = cleanText(r.funcao);
      const funcaoNorm = funcaoRaw ? normalizeFuncaoUpper(funcaoRaw) : "";
      rows.push({
        nome,
        funcao: funcaoNorm,
        funcaoSlug: funcaoNorm ? funcaoToSlug(funcaoNorm) : null,
      });
    }

    return dedupeParticipantes(rows);
  } finally {
    await browser.close();
  }
}

async function ensureDirForFile(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function saveJson(filePath, data) {
  await ensureDirForFile(filePath);
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
  } catch (err) {
    const e = new Error(`Erro ao salvar arquivo: ${filePath}`);
    e.cause = err;
    throw e;
  }
}

async function main() {
  let origem = "";
  let participantes = [];

  const html = await fetchHtmlSimple();
  if (hasBarItems(html)) {
    participantes = parseBarFromCheerio(html);
    if (participantes.length > 0) {
      origem = "html-estatico-barra";
    }
  }

  if (participantes.length === 0) {
    participantes = await extractBarWithPuppeteer();
    if (participantes.length > 0) {
      origem = "puppeteer-barra";
    }
  }

  if (participantes.length === 0) {
    throw new Error(
      'Nenhum item na barra (.participant-bar__list .participant-bar__item). Verifique a página ou seletores.',
    );
  }

  await saveJson(OUTPUT_PATH, participantes);
  await saveJson(OUTPUT_LATEST_PATH, {
    version: 1,
    updatedAt: new Date().toISOString(),
    count: participantes.length,
    source: SOURCE_ID,
    origin: origem,
  });

  console.log(`Origem: ${origem}`);
  console.log(`Encontrados: ${participantes.length}`);
  console.log(`Arquivo: ${OUTPUT_PATH}`);
  for (const p of participantes) {
    const f = p.funcao ? ` — ${p.funcao}` : "";
    console.log(`- ${p.nome}${f}`);
  }
}

main().catch((err) => {
  console.error(err?.message || String(err));
  if (err?.cause) console.error("Causa:", err.cause);
  process.exitCode = 1;
});
