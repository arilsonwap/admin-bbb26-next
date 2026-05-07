/* eslint-disable no-console */
const fs = require("node:fs/promises");
const path = require("node:path");
const cheerio = require("cheerio");

const PAGE_URL = "https://media.r7.com/r7/media/casa_do_patrao/index.html";
const OUTPUT_PATH = path.resolve(process.cwd(), "data/casa-do-patrao-participantes.json");
const OUTPUT_LATEST_PATH = path.resolve(process.cwd(), "data/casa-do-patrao-participantes-latest.json");
const SOURCE_ID = "casa_do_patrao_r7";

function cleanText(value) {
  if (!value) return "";
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveUrl(maybeUrl) {
  const raw = cleanText(maybeUrl);
  if (!raw) return "";
  try {
    return new URL(raw, PAGE_URL).toString();
  } catch {
    return raw;
  }
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
  if (!f) return "";
  if (f === "PATRÃO") return "patrao";
  if (f === "PARÇA") return "parca";
  return toSlug(f);
}

function parseParticipantsFromHtml(html) {
  const cards = [];
  const $ = cheerio.load(html);

  $(".participant-card").each((_, el) => {
    const $card = $(el);
    const nome = cleanText($card.find("h3").first().text());
    if (!nome) return;

    const funcao = normalizeFuncaoUpper($card.find(".role-badge").first().text());
    const funcaoSlug = funcao ? funcaoToSlug(funcao) : null;
    cards.push({ nome, funcao, funcaoSlug });
  });

  // Dedup simples por (nome + funcao)
  const seen = new Set();
  const unique = [];
  for (const p of cards) {
    const key = `${p.nome}::${p.funcao}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }

  return unique;
}

function hasParticipantCards(html) {
  const $ = cheerio.load(html);
  return $(".participant-card").length > 0;
}

async function fetchHtmlSimple() {
  let res;
  try {
    res = await fetch(PAGE_URL, {
      method: "GET",
      headers: {
        "user-agent": "Mozilla/5.0 (Node.js) casa-do-patrao-scraper",
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

async function fetchHtmlWithPuppeteer() {
  let puppeteer;
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    puppeteer = require("puppeteer");
  } catch {
    throw new Error(
      "Nenhum participante encontrado via HTML estático. Para páginas que dependem de JS, instale o puppeteer e rode novamente: npm i -D puppeteer",
    );
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto(PAGE_URL, { waitUntil: "networkidle2", timeout: 60_000 });
    try {
      await page.waitForSelector(".participant-card", { timeout: 30_000 });
    } catch (err) {
      const isTimeout =
        err?.name === "TimeoutError" ||
        String(err?.message || "").toLowerCase().includes("waiting for selector") ||
        String(err?.message || "").toLowerCase().includes("timeout");

      if (isTimeout) {
        const e = new Error(
          'Puppeteer carregou a página, mas não encontrou ".participant-card" em até 30s (possível mudança de classe/estrutura ou conteúdo não carregou).',
        );
        e.cause = err;
        throw e;
      }
      throw err;
    }
    return await page.content();
  } catch (err) {
    const e = new Error(`Erro ao acessar a página (puppeteer): ${PAGE_URL}`);
    e.cause = err;
    throw e;
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
  const html = await fetchHtmlSimple();
  let origem = "";
  let participantes = [];

  if (hasParticipantCards(html)) {
    participantes = parseParticipantsFromHtml(html);
    if (participantes.length > 0) {
      origem = "html-estatico";
    }
  }

  if (participantes.length === 0) {
    const htmlRendered = await fetchHtmlWithPuppeteer();
    participantes = parseParticipantsFromHtml(htmlRendered);
    if (participantes.length > 0) {
      origem = "puppeteer";
    }
  }

  if (participantes.length === 0) {
    throw new Error("Nenhum participante encontrado (verifique mudanças no HTML: .participant-card / h3 / .role-badge / img).");
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
  console.log(`Arquivo salvo em: ${OUTPUT_PATH}`);
  console.log("Resumo:");
  for (const p of participantes) {
    const funcao = p.funcao ? ` - ${p.funcao}` : "";
    console.log(`- ${p.nome}${funcao}`);
  }
}

main().catch((err) => {
  console.error(err?.message || String(err));
  if (err?.cause) console.error("Causa:", err.cause);
  process.exitCode = 1;
});

