import { chromium } from "playwright";
import fs from "fs";

const urls = [
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/solange-couto/", // CONGELADO - não buscar
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/breno/", // REMOVIDO - não buscar
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/marcelo/", // REMOVIDO - não buscar
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/maxiane/", // REMOVIDO - não buscar
  "https://gshow.globo.com/realities/bbb/bbb-26/participantes/samira/",
  "https://gshow.globo.com/realities/bbb/bbb-26/participantes/leandro/",
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/alberto-cowboy/", // CONGELADO - não buscar
  "https://gshow.globo.com/realities/bbb/bbb-26/participantes/ana-paula-renault/",
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/babu-santana/", // REMOVIDO - não buscar
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/brigido/", // REMOVIDO - não buscar
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/chaiany/", // CONGELADO - não buscar
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/edilson/", // REMOVIDO - não buscar
  "https://gshow.globo.com/realities/bbb/bbb-26/participantes/gabriela/",
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/jonas-sulzbach/", // REMOVIDO - não buscar
  "https://gshow.globo.com/realities/bbb/bbb-26/participantes/jordana/",
  "https://gshow.globo.com/realities/bbb/bbb-26/participantes/juliano-floss/",
  "https://gshow.globo.com/realities/bbb/bbb-26/participantes/marciele/",
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/matheus/", // REMOVIDO - não buscar
  "https://gshow.globo.com/realities/bbb/bbb-26/participantes/milena/",
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/paulo-augusto/", // REMOVIDO - não buscar
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/sarah-andrade/", // REMOVIDO - não buscar
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/sol-vega/" // REMOVIDO - não buscar
];

function yyyy_mm_dd() {
  return new Date().toISOString().slice(0, 10);
}

// Função para tentar fechar overlays/cookies básicos
async function handleBasicOverlays(page) {
  try {
    // Seletores básicos de consentimento/cookies
    const basicSelectors = [
      'button:has-text("Aceitar")',
      'button:has-text("Concordo")',
      'button:has-text("OK")',
      '[aria-label*="aceitar" i]',
      '[data-testid*="accept" i]'
    ];

    for (const selector of basicSelectors) {
      try {
        const btn = page.locator(selector).first();
        if (await btn.count() > 0 && await btn.isVisible()) {
          await btn.click({ timeout: 2000 }).catch(() => {});
          console.log(`  🔧 Fechou overlay básico: ${selector}`);
          await page.waitForTimeout(500);
          break; // Fecha apenas o primeiro encontrado
        }
      } catch (e) {
        // Ignora erros individuais
      }
    }
  } catch (e) {
    // Ignora erros na tentativa de fechar overlays
  }
}

// Classificar tipo de erro
function classifyError(message) {
  const m = (message || "").toLowerCase();
  if (m.includes("429") || m.includes("rate")) return "rate_limit";
  if (m.includes("timeout") || m.includes("waiting")) return "timeout";
  if (m.includes("net::") || m.includes("network") || m.includes("connection")) return "network";
  return "other";
}

// Função para tentar múltiplas vezes um participante que falhou
async function retryParticipant(url, context, date) {
  const maxAttempts = 3; // Mesmo número de tentativas que o queridometro.js
  let last = null;
  let tries = 0;

  for (let retry = 1; retry <= maxAttempts; retry++) {
    const attempt = retry + 1; // 2..4
    tries++;

    console.log(`🔄 Tentativa ${retry}/${maxAttempts} para: ${url.split('/').pop()}`);

    const result = await processParticipant(context, url, attempt);
    last = result;

    if (result.ok) {
      console.log(`✅ Recuperado na tentativa ${retry}: ${url.split('/').pop()}`);
      return {
        ok: true,
        value: { date, url, tab: "Recebidos", ...result.data, attempts: tries }
      };
    }

    const isPermanent =
      ['not_found', 'blocked', 'client_error'].includes(result.errorType);

    if (isPermanent) {
      console.log(`🛑 Erro permanente (${result.errorType}), parando: ${url.split('/').pop()}`);
      break;
    }

    // Aguardar 1 segundo entre tentativas
    await new Promise(r => setTimeout(r, 1000));
  }

  return {
    ok: false,
    value: {
      url,
      date,
      error: last?.error || "Falha desconhecida",
      errorType: last?.errorType || "other",
      evidence: last?.evidence,
      attempts: tries
    }
  };
}

// Função para processar uma URL específica
async function processParticipant(context, url, attempt = 1) {
  let page;
  let evidence = {
    httpStatus: null,
    finalUrl: null,
    hasRoot: false,
    countersLen: 0,
    receivedLen: 0,
    title: null
  };

  try {
    page = await context.newPage();
    page.setDefaultTimeout(60000);

    console.log(`Carregando: ${url}${attempt > 1 ? ` (tentativa ${attempt})` : ''}`);

    // Estratégia de carregamento baseada na tentativa
    let waitUntil;
    if (attempt === 1) {
      waitUntil = "load";
    } else {
      waitUntil = "networkidle";
    }

    // Carregar página
    const response = await page.goto(url, { waitUntil, timeout: 60000 });
    evidence.httpStatus = response?.status() || null;
    evidence.finalUrl = response?.url() || url;

    // Forçar classificação por HTTP status
    if (evidence.httpStatus === 429) throw new Error("rate_limit");
    if (evidence.httpStatus >= 500) throw new Error(`server_error_${evidence.httpStatus}`);
    if (evidence.httpStatus >= 400) throw new Error(`client_error_${evidence.httpStatus}`);

    // Coletar título para diagnóstico
    evidence.title = await page.title().catch(() => null);

    // Tentar fechar overlays básicos
    await handleBasicOverlays(page);

    // Aguardar pela seção do queridômetro
    try {
      await page.waitForSelector("section.post-queridometro-tabs", { timeout: 15000 });
      evidence.hasRoot = true;

      // Scroll para garantir visibilidade
      await page.locator("section.post-queridometro-tabs").scrollIntoViewIfNeeded().catch(()=>{});

      // Espera inteligente: aguardar conteúdo útil
      await page.waitForFunction(() => {
        const root = document.querySelector("section.post-queridometro-tabs");
        if (!root) return false;
        const counters = root.querySelectorAll(".post-queridometro-counter-item").length;
        const received = root.querySelectorAll("a.post-queridometro-tabs__participant-received-item").length;
        // Validação: received > 0 OU counters >= 3
        return received > 0 || counters >= 3;
      }, { timeout: 12000 }).catch(() => {
        console.log(`  ⏳ Conteúdo ainda carregando, tentando extrair mesmo assim`);
      });
    } catch (e) {
      evidence.hasRoot = false;
      console.log(`  ⚠️  Seção queridômetro não encontrada`);
    }

    const data = await extractFromPage(page);
    if (data) {
      evidence.countersLen = data.counters?.length || 0;
      evidence.receivedLen = data.received?.length || 0;

      // Validação final: conteúdo útil
      const hasUsefulContent = (data.received?.length > 0) || (data.counters?.length >= 3);

      if (hasUsefulContent) {
        console.log(`✅ Extraído dados de: ${url}`);
        return { ok: true, data };
      } else {
        console.log(`❌ Conteúdo insuficiente em: ${url}`);
        return { ok: false, error: "Conteúdo insuficiente", errorType: "insufficient", evidence };
      }
    } else {
      console.log(`❌ Dados não encontrados em: ${url}`);
      return { ok: false, error: "Dados não encontrados", errorType: "not_found", evidence };
    }
  } catch (error) {
    console.error(`❌ Erro ao carregar ${url}:`, error.message.substring(0, 60));
    return { ok: false, error: error.message, errorType: classifyError(error.message), evidence };
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (e) {
        // Ignorar erros de fechamento
      }
    }
  }
}

async function extractFromPage(page) {
  return await page.evaluate(() => {
    const root = document.querySelector("section.post-queridometro-tabs");
    if (!root) return null;

    // Counters (totais) - com normalização robusta
    const counters = [...root.querySelectorAll(".post-queridometro-counter-item")]
      .map(item => {
        const emoji = item.querySelector("img[alt]")?.getAttribute("alt")?.trim() || null;
        const rawText = item.querySelector(".post-queridometro-counter-item__count")?.textContent?.trim() || "0";
        // Remove tudo que não é dígito (emojis, espaços, etc.)
        const count = parseInt(rawText.replace(/[^\d]/g, "") || "0", 10);
        return { emoji, count };
      })
      .filter(x => x.emoji);

    // Lista Recebidos (quem deu qual emoji)
    const received = [...root.querySelectorAll("a.post-queridometro-tabs__participant-received-item")]
      .map(a => {
        const fromName =
          a.querySelector("img.post-queridometro-tabs__participant-image")?.getAttribute("alt")?.trim() || null;
        const emoji =
          a.querySelector("img.post-queridometro-tabs__participant-emoji")?.getAttribute("alt")?.trim() || null;
        const profileUrl = a.getAttribute("href") || null;
        return { fromName, emoji, profileUrl };
      })
      .filter(x => x.fromName && x.emoji);

    // Agrupar: { coracao: [Breno, Marcelo...], planta: [...], ... }
    const porEmoji = {};
    for (const r of received) {
      porEmoji[r.emoji] ??= [];
      porEmoji[r.emoji].push(r.fromName);
    }

    return { counters, received, porEmoji };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const date = yyyy_mm_dd();
  const out = [];
  const stats = { success: 0, errors: 0, total: urls.length };

  // Tentativa inicial para todos os participantes
  console.log("=== TENTATIVA INICIAL ===");
  for (const url of urls) {
    const result = await processParticipant(context, url, 1);

    if (result.ok) {
      out.push({ date, url, tab: "Recebidos", ...result.data, attempts: 1 });
      stats.success++;
    } else {
      console.log(`❌ Falhou na primeira tentativa: ${url.split('/').pop()}`);
      // Tentar novamente com retry
      const retry = await retryParticipant(url, context, date);
      out.push(retry.value);
      if (retry.ok) {
        stats.success++;
      } else {
        stats.errors++;
      }
    }
  }

  await context.close();
  await browser.close();

  fs.mkdirSync("data", { recursive: true });
  const filename = `data/queridometro-${date}.json`;
  fs.writeFileSync(filename, JSON.stringify(out, null, 2));

  // Resumo final
  console.log(`\n📊 RESUMO FINAL:`);
  console.log(`✅ Sucessos: ${stats.success}/${stats.total}`);
  console.log(`❌ Erros: ${stats.errors}/${stats.total}`);
  console.log(`💾 Salvo: ${filename}`);

  // Estatísticas de tentativas
  const totalAttempts = out.reduce((sum, item) => sum + (item.attempts || 1), 0);
  const retried = out.filter(item => (item.attempts || 1) > 1).length;
  console.log(`🔄 Total de tentativas: ${totalAttempts} (${retried} participantes retry)`);

  // Mostrar erros com evidence mínima
  const errors = out.filter(item => item.error);
  if (errors.length > 0) {
    console.log(`\n🔍 ERROS DETALHADOS:`);
    errors.forEach((error, i) => {
      const slug = error.url?.split('/').pop() || error.pageUrl?.split('/').pop() || 'desconhecido';
      const ev = error.evidence || {};
      const attempts = error.attempts || 1;
      console.log(`${i+1}. ${slug}: ${error.error} (${attempts} tentativas)`);
      console.log(`   HTTP: ${ev.httpStatus || 'N/A'} | Section: ${ev.hasRoot ? 'SIM' : 'NÃO'} | Counters: ${ev.countersLen} | Received: ${ev.receivedLen}`);
    });
  }
})();