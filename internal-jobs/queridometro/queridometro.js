import { chromium } from "playwright";
import fs from "fs";

// Lista de participantes do BBB26
// Para ignorar participantes eliminados, comente a linha correspondente
// OU use variável de ambiente: IGNORED_PARTICIPANTS=matheus,solange
let urls = [
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/solange-couto/", // CONGELADO - não buscar
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/breno/", // REMOVIDO - não buscar
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/marcelo/", // REMOVIDO - não buscar
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/maxiane/", // REMOVIDO - não buscar
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/samira/", // não buscar
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
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/matheus/", // ELIMINADO - ignorar busca
  "https://gshow.globo.com/realities/bbb/bbb-26/participantes/milena/",
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/paulo-augusto/", // REMOVIDO - não buscar
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/sarah-andrade/", // REMOVIDO - não buscar
  // "https://gshow.globo.com/realities/bbb/bbb-26/participantes/sol-vega/" // REMOVIDO - não buscar
];

// Filtrar participantes ignorados via variável de ambiente
const ignoredParticipants = process.env.IGNORED_PARTICIPANTS;
if (ignoredParticipants) {
  const ignored = ignoredParticipants.split(',').map(p => p.trim().toLowerCase());
  urls = urls.filter(url => {
    const participantName = url.split('/').pop()?.toLowerCase();
    return !ignored.includes(participantName);
  });
  console.log(`Participantes ignorados: ${ignored.join(', ')}`);
}

function yyyy_mm_dd() {
  // Usar timezone local (Brasil) em vez de UTC
  // Evita problemas quando roda perto da meia-noite
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Normalizar nomes de emojis para chaves consistentes
function normalizeEmoji(emoji) {
  if (!emoji) return null;

  // Remover acentos primeiro (NFD), depois limpar
  const normalized = emoji
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

  // Mapeamento específico para consistência (versões normalizadas sem acento)
  const emojiMap = {
    'coracao': 'coracao',
    'coracao_partido': 'coracao_partido',
    'planta': 'planta',
    'biscoito': 'biscoito',
    'alvo': 'alvo',
    'mala': 'mala',
    'vomito': 'vomito',
    'cobra': 'cobra',
    'mentiroso': 'mentiroso',

    // ✅ Versões normalizadas (sem acento) - agora funcionam!
    'nariz_de_pinoquio': 'mentiroso',
    'nariz_de_pinocio': 'mentiroso'
  };

  return emojiMap[normalized] || normalized;
}

async function extractFromPage(page) {
  return await page.evaluate(() => {
    const root = document.querySelector("section.post-queridometro-tabs");
    if (!root) return null;

    // Counters (totais) - limpar caracteres não-numéricos
    const counters = [...root.querySelectorAll(".post-queridometro-counter-item")]
      .map(item => {
        const emoji = item.querySelector("img[alt]")?.getAttribute("alt")?.trim() || null;
        const rawCount = item.querySelector(".post-queridometro-counter-item__count")?.textContent?.trim() || "0";
        const count = parseInt(rawCount.replace(/\D+/g, "") || "0", 10);
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

    return { counters, received };
  });
}

// Processar dados coletados (formato perfeito para o app)
function processParticipantData(data, url) {
  if (!data) return null;

  // Normalizar received (fonte da verdade para o app)
  let normalizedReceived = data.received.map(item => ({
    fromName: item.fromName,
    emoji: normalizeEmoji(item.emoji),
    profileUrl: item.profileUrl // opcional, só para debug
  })).filter(x => x.fromName && x.emoji);

  // 🔧 DEDUPLICAR por profileUrl (mais confiável que nome)
  // Evita contagens infladas se Gshow mandar dados duplicados
  const seen = new Set();
  normalizedReceived = normalizedReceived.filter(item => {
    // Chave única: profileUrl (se existir) ou fromName+emoji (fallback)
    const key = item.profileUrl || `${item.fromName}:${item.emoji}`;
    if (seen.has(key)) {
      return false; // Já viu essa combinação, remove duplicata
    }
    seen.add(key);
    return true;
  });

  // Retornar apenas os campos obrigatórios/opcionais do modelo perfeito
  return {
    received: normalizedReceived
  };
}

// Função para tentar fechar overlays/banners automaticamente
async function handleOverlays(page) {
  try {
    // Seletores específicos para cookies/consent da Globo (mais seguros)
    const candidates = [
      'button:has-text("Aceitar")',
      'button:has-text("Concordo")',
      'button:has-text("Entendi")',
      'button:has-text("Fechar")',
      'button:has-text("OK")',
      '[aria-label*="fechar" i]',
      '[aria-label*="aceitar" i]',
      '[data-testid="cookie-banner-accept"]'
    ];

    // Tentar apenas um botão por vez, parar após o primeiro sucesso
    for (const sel of candidates) {
      try {
        const el = page.locator(sel).first();
        if (await el.count() > 0) {
          await el.click({ timeout: 800 }).catch(() => {});
          console.log(`  🔧 Fechou overlay: ${sel}`);
          await page.waitForTimeout(500);
          break; // Parar após clicar no primeiro botão encontrado
        }
      } catch (e) {
        // Ignorar erros individuais e continuar tentando
      }
    }
  } catch (e) {
    // Ignorar erros na tentativa de fechar overlays
  }
}

// Função para tentar múltiplas vezes um participante que falhou
async function retryParticipant(url, context, date) {
  const maxAttempts = 3;
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
        value: {
          date,
          pageUrl: url,
          tab: "Recebidos",
          ...result.data
        }
      };
    }

    const isPermanent =
      ['not_found', 'blocked', 'client_error'].includes(result.errorType);

    if (isPermanent) {
      console.log(`🛑 Erro permanente (${result.errorType}), parando: ${url.split('/').pop()}`);
      break;
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  return {
    ok: false,
    value: {
      date,
      pageUrl: url,
      tab: "Recebidos",
      received: [], // ✅ Mantém compatível com app (received obrigatório)
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
    page.setDefaultTimeout(30000);

    console.log(`Carregando: ${url}${attempt > 1 ? ` (tentativa ${attempt})` : ''}`);

    // Estratégia de carregamento baseada na tentativa
    let waitUntil;
    if (attempt === 1) {
      waitUntil = "domcontentloaded"; // Rápido
    } else if (attempt === 2) {
      waitUntil = "load"; // Mais completo
    } else {
      waitUntil = "networkidle"; // Completo (só para retryable)
    }

    // Carregar página com detecção de status HTTP
    let response;
    try {
      response = await page.goto(url, { waitUntil, timeout: attempt === 1 ? 30000 : 45000 });
      if (!response) throw new Error("network: no response");

      evidence.httpStatus = response.status();
      evidence.finalUrl = response.url();

      if (evidence.httpStatus === 429) throw new Error(`rate_limit: ${evidence.httpStatus}`);
      if (evidence.httpStatus >= 500) throw new Error(`server_error: ${evidence.httpStatus}`);
      if (evidence.httpStatus >= 400) throw new Error(`client_error: ${evidence.httpStatus}`);
    } catch (gotoError) {
      throw gotoError;
    }

    // Coletar evidências básicas
    evidence.title = await page.title().catch(() => null);

    // Verificar bloqueios no título
    if (evidence.title && (
      evidence.title.toLowerCase().includes('access denied') ||
      evidence.title.toLowerCase().includes('forbidden') ||
      evidence.title.toLowerCase().includes('blocked') ||
      evidence.title.toLowerCase().includes('captcha') ||
      evidence.title.toLowerCase().includes('paywall')
    )) {
      return { ok: false, error: "Página bloqueada/paywall", errorType: "blocked", evidence };
    }

    // Tentar fechar overlays
    await handleOverlays(page);

    // Configurar timeout do selector baseado na tentativa
    const selectorTimeout = attempt === 1 ? 15000 : 25000;

    // Aguardar pelo queridômetro
    try {
      await page.waitForSelector("section.post-queridometro-tabs", { timeout: selectorTimeout });
      evidence.hasRoot = true;

      // Scroll para garantir visibilidade
      await page.locator("section.post-queridometro-tabs").scrollIntoViewIfNeeded().catch(()=>{});

      // Espera inteligente: aguardar até que haja conteúdo real (não só o container)
      await page.waitForFunction(() => {
        const root = document.querySelector("section.post-queridometro-tabs");
        if (!root) return false;
        const counters = root.querySelectorAll(".post-queridometro-counter-item").length;
        const received = root.querySelectorAll("a.post-queridometro-tabs__participant-received-item").length;
        return counters > 0 || received > 0;
      }, { timeout: attempt === 1 ? 8000 : 15000 }).catch(() => {
        console.log(`  ⏳ Conteúdo ainda carregando, tentando extrair mesmo assim`);
      });
    } catch (e) {
      evidence.hasRoot = false;
      console.log(`  ⚠️  Selector não encontrado, tentando extrair mesmo assim`);
    }

    let rawData;
    try {
      rawData = await extractFromPage(page);
      evidence.countersLen = rawData?.counters?.length || 0;
      evidence.receivedLen = rawData?.received?.length || 0;
    } catch (evaluateError) {
      // Erro no evaluate (DOM quebrado)
      return { ok: false, error: "Erro no DOM/evaluate", errorType: "dom", evidence };
    }

    // Validação: verificar se tem conteúdo real
    const hasContent = rawData && (rawData.counters?.length > 0 || rawData.received?.length > 0);

    if (hasContent) {
      const processedData = processParticipantData(rawData, url);

      if (processedData) {
        console.log(`✅ Extraído dados de: ${url}`);

        return { ok: true, data: processedData };
      }
    }

    // Não encontrou dados (participante eliminado ou sem módulo)
    console.log(`❌ Dados não encontrados em: ${url}`);
    return { ok: false, error: "Dados não encontrados", errorType: "not_found", evidence };

  } catch (error) {
    console.error(`❌ Erro ao carregar ${url}:`, error.message.substring(0, 60));
    return { ok: false, error: error.message, errorType: getErrorType(error), evidence };
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

// Função para categorizar tipo de erro (fallback para casos não classificados)
function getErrorType(error) {
  const message = error.message.toLowerCase();

  if (message.includes('rate_limit')) return 'rate_limit';
  if (message.includes('server_error')) return 'server_error';
  if (message.includes('client_error')) return 'client_error';
  if (message.includes('timeout') || message.includes('waiting')) return 'timeout';
  if (message.includes('network') || message.includes('connection') || message.includes('no response')) return 'network';

  // Erros de DOM/JS
  if (message.includes('execution context') || message.includes('cannot read') || message.includes('dom')) return 'dom';

  return 'other';
}

(async () => {
  const browser = await chromium.launch();

  // Criar contexto com bloqueio de recursos pesados
  const context = await browser.newContext();
  await context.route("**/*", route => {
    const type = route.request().resourceType();
    if (type === "image" || type === "font" || type === "media") return route.abort();
    route.continue();
  });

  const date = yyyy_mm_dd();
  const out = [];

  try {
    // Tentativa inicial para todos os participantes
    console.log("=== TENTATIVA INICIAL ===");
    for (const url of urls) {
      const result = await processParticipant(context, url, 1);

      if (result.ok) {
        out.push({
          date,
          pageUrl: url,
          tab: "Recebidos",
          ...result.data
        });
      } else {
        const retry = await retryParticipant(url, context, date);
        out.push(retry.value);
      }
    }

  } finally {
    try {
      await context.close();
    } catch (e) {
      // Ignorar erros de fechamento do context
    }
    await browser.close();
  }

  fs.mkdirSync("data", { recursive: true });
  const file = `data/queridometro-${date}.json`;
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`\n💾 Salvo: ${file}`);

  const successCount = out.filter(item => !item.error).length;
  const errorCount = out.filter(item => item.error).length;
  console.log(`📊 Resultado: ${successCount} sucesso, ${errorCount} erro(s)`);

  const withErrors = out.filter((item) => item.error);
  if (withErrors.length > 0) {
    const labels = withErrors.map((item) => {
      const url = item.pageUrl || "";
      try {
        const seg = new URL(url).pathname.replace(/\/$/, "").split("/").filter(Boolean).pop();
        return seg ? seg.replace(/-/g, " ") : url;
      } catch {
        return url || "(url desconhecida)";
      }
    });
    console.log(
      `\n⚠️ Nota final: busca com falha para ${withErrors.length} participante(s): ${labels.join(", ")}`
    );
  } else {
    console.log("\n✅ Nota final: nenhuma falha de busca registrada para os participantes desta execução.");
  }
})();