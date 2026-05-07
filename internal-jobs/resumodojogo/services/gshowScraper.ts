import { chromium, Browser, Page } from "playwright";

export interface HistoricoData {
  lider: number;
  paredao: number;
  imune: number;
  anjo: number;
  naMira: number;
  monstro: number;
  vip: number;
  xepa: number;
}

export interface ParticipantData {
  id: string;
  url: string;
  status: string | null;
  estalecas: number | null;
  historico: HistoricoData;
}

export interface ScraperError {
  url: string;
  error: string;
}

export type ScraperResult = ParticipantData | ScraperError;

const ALWAYS_DISQUALIFIED_IDS = new Set(["sol-vega", "edilson"]);

function normalizeText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function pickMatch(text: string, regex: RegExp, castNumber = false): string | number | null {
  const match = text.match(regex);
  if (!match) return null;

  const value = match[1]?.trim();
  if (!castNumber) return value ?? null;

  if (value == null) return null;

  const num = Number(String(value).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(num) ? num : null;
}

function getCount(text: string, labelVariants: string[]): number {
  // pega "label + numero" no texto da página
  // exemplo: "líder 1", "vip 3", "na mira 0"
  const labelGroup = labelVariants
    .map(v => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  const regex = new RegExp(`(?:^|\\n|\\s)(?:${labelGroup})\\s+(\\d+)(?:\\s|$)`, "iu");
  return (pickMatch(text, regex, true) as number) ?? 0;
}

function extractIdFromUrl(url: string): string {
  // Extrai o ID da URL do participante
  // Exemplo: https://gshow.globo.com/realities/bbb/bbb-26/participantes/alberto-cowboy/
  // Resultado: alberto-cowboy
  const match = url.match(/\/participantes\/([^\/]+)\/?$/);
  return match ? match[1] : url;
}

function isAlwaysDisqualifiedParticipant(id: string): boolean {
  return ALWAYS_DISQUALIFIED_IDS.has(id.toLowerCase());
}

function extractStatus(text: string, participantName?: string): string | null {
  // Pega só o conteúdo ENTRE "Status" e "Estalecas" ou "Histórico"
  const statusMatch = text.match(/Status[\s\S]*?(?:Estalecas|Histórico)/iu);
  if (statusMatch) {
    let status = statusMatch[0]
      .replace(/Status/i, "")
      .replace(/Estalecas|Histórico/i, "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

    // Se vier "vip xepa" etc, vira "vip,xepa"
    if (status && status.includes(" ")) {
      status = status.split(" ").filter(Boolean).join(",");
    }

    if (status && !/^\d+$/.test(status)) return status;
  }

  // Status especiais: se não tem bloco Status, às vezes aparece "eliminado" na página
  const specialStatusMatch = text.match(/\b(eliminad[ao]|desclassificado)\b/iu);
  if (specialStatusMatch) {
    let status = specialStatusMatch[1].toLowerCase();

    if (
      status === "eliminado" &&
      participantName &&
      participantName.toLowerCase().endsWith("a")
    ) {
      status = "eliminada";
    }

    return status;
  }

  // ❌ SEM fallback genérico. Melhor retornar null do que chutar.
  return null;
}

export async function scrapeParticipant(url: string): Promise<ParticipantData> {
  const id = extractIdFromUrl(url);
  if (isAlwaysDisqualifiedParticipant(id)) {
    return {
      id,
      url,
      status: "desclassificado",
      estalecas: null,
      historico: {
        lider: 0,
        paredao: 0,
        imune: 0,
        anjo: 0,
        naMira: 0,
        monstro: 0,
        vip: 0,
        xepa: 0,
      },
    };
  }

  const browser: Browser = await chromium.launch({ headless: true });
  const page: Page = await browser.newPage({
    // ajuda a evitar variações estranhas de locale
    locale: "pt-BR",
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
  });

  try {
    // tenta carregar e esperar os rótulos aparecerem
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

    // Espera o container principal aparecer (mais confiável que textos específicos)
    await page
      .locator("main")
      .waitFor({ timeout: 20000 })
      .catch(() => {
        /* ainda tentamos ler, mas o gate vai bloquear se vier vazio */
      });

    // 🚨 CORREÇÃO: GShow usa carregamento dinâmico lento!
    // O conteúdo do participante leva tempo para carregar após o DOM inicial
    // Vamos aguardar especificamente pelos elementos de Status/Histórico
    try {
      await page.waitForFunction(
        () => {
          const text = document.body.innerText || "";
          return /\bStatus\b/i.test(text) || /\bHistórico\b/i.test(text) || /\b(eliminad[ao]|desclassificado)\b/i.test(text);
        },
        { timeout: 15000 } // 15 segundos para carregamento dinâmico
      );
    } catch (e) {
      // Se timeout, continua mesmo assim (o sistema de retry vai tentar novamente)
    }

    // garante um tempinho extra pro JS renderizar completamente
    await page.waitForTimeout(2000); // aumentei para 2 segundos

    const rawText = await page.evaluate(() => {
      // 🚨 PROBLEMA: seletores específicos podem não funcionar com carregamento dinâmico
      // Vamos tentar uma abordagem mais robusta

      // Primeiro tenta o seletor original
      let section = document.querySelector(
        "main .post-card-personalities-bbb__section"
      );

      // Se não encontrou, tenta seletores alternativos
      if (!section) {
        // Tenta encontrar qualquer seção BBB
        section = document.querySelector('[class*="bbb"]');
      }

      if (!section) {
        // Tenta encontrar seções de participantes
        section = document.querySelector('[class*="participant"], [class*="participante"]');
      }

      if (!section) {
        // Última tentativa: pega o main inteiro
        section = document.querySelector('main');
      }

      // 🚨 SOLUÇÃO: se ainda não encontrou, usa document.body como fallback
      if (!section) {
        return document.body.innerText || "";
      }

      return (section as HTMLElement).innerText || "";
    });
    const text = normalizeText(rawText);

    // Gate de segurança robusto: verifica conteúdo essencial da página
    const hasStatusLabel = /\bStatus\b/i.test(text);
    const hasHistorico = /\bHistórico\b/i.test(text);
    const hasEliminado = /\b(eliminad[ao]|desclassificado)\b/i.test(text);

    // Caso 1: página de participante (ativo) -> tem Status OU Histórico
    const okActive = hasStatusLabel || hasHistorico;
    // Caso 2: eliminado/desclassificado -> termo especial
    const okSpecial = hasEliminado;

    if (!okActive && !okSpecial) {
      throw new Error("Conteúdo principal não encontrado (página instável ou layout mudou)");
    }

    const status = extractStatus(text, id.replace('-', ' '));

    // Extrai estalecas diretamente do DOM (mais confiável)
    const estalecas = await page.evaluate(() => {
      function parsePtNumber(raw: string): number | null {
        const s = (raw || "")
          .trim()
          .replace(/\u00a0/g, " ")     // nbsp
          .replace(/\s+/g, " ");      // normalize spaces

        // Primeiro tenta extrair apenas números do texto (ex: "Estalecas1450" -> "1450")
        const numOnly = s.replace(/[^\d.,+-]/g, ""); // remove tudo exceto números, pontos, vírgulas, sinais

        // Se não encontrou números, tenta o texto original
        const target = numOnly || s;

        // aceita: -150, +150, 150, -1.500, 1.500
        // (se vier com vírgula, também funciona: -1.500,50 -> vira -1500.50)
        const m = target.match(/^[+-]?\d{1,3}(\.\d{3})*(,\d+)?$|^[+-]?\d+(,\d+)?$/);
        if (!m) return null;

        const normalized = target.replace(/\./g, "").replace(",", ".");
        const n = Number(normalized);
        return Number.isFinite(n) ? n : null;
      }

      // 1) tente achar um elemento mais "semântico" primeiro (se existir)
      let el: Element | null =
        document.querySelector('[data-testid*="estaleca" i]') ||
        document.querySelector('[class*="estaleca" i]') ||
        null;

      // 2) fallback: varre spans, mas agora aceitando negativos e valores curtos
      if (!el) {
        const spans = Array.from(document.querySelectorAll("span"));
        const candidates = spans
          .map((span) => ({ span, text: (span.textContent || "").trim() }))
          .map((x) => ({ ...x, value: parsePtNumber(x.text) }))
          .filter((x) => x.value !== null) as Array<{ span: HTMLSpanElement; text: string; value: number }>;

        // Heurística: se tiver label "Estalecas" por perto, prioriza
        const scored = candidates.map((c) => {
          const parentText = (c.span.parentElement?.textContent || "").toLowerCase();
          const score =
            (parentText.includes("estaleca") ? 10 : 0) +
            (parentText.includes("est") ? 1 : 0) +
            Math.min(3, Math.floor(Math.abs(c.value) / 1000)); // leve
          return { ...c, score };
        });

        scored.sort((a, b) => b.score - a.score);
        el = scored[0]?.span || null;
      }

      const raw = (el?.textContent || "").trim();
      const n = parsePtNumber(raw);
      return n;
    });

    const historico: HistoricoData = {
      lider: getCount(text, ["líder", "lider"]),
      paredao: getCount(text, ["paredão", "paredao"]),
      imune: getCount(text, ["imune"]),
      anjo: getCount(text, ["anjo"]),
      naMira: getCount(text, ["na mira"]),
      monstro: getCount(text, ["monstro"]),
      vip: getCount(text, ["vip"]),
      xepa: getCount(text, ["xepa"]),
    };

    return { id, url, status, estalecas, historico };
  } finally {
    await browser.close();
  }
}

export async function scrapeMultipleParticipants(urls: string[]): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];
  const total = urls.length;

  console.log(`🚀 Iniciando processamento de ${total} participante(s)...\n`);

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const current = i + 1;
    const participantName = extractIdFromUrl(url).replace(/-/g, ' ');

    console.log(`[${current}/${total}] 🔍 Processando: ${participantName}`);
    console.log(`    URL: ${url}`);

    // Sistema de retry para erros de conteúdo não encontrado
    const maxRetries = 3;
    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
      attempt++;

      if (attempt > 1) {
        console.log(`    🔄 Tentativa ${attempt}/${maxRetries} (aguardando 2s...)`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Espera 2 segundos entre tentativas
      }

      try {
        const data = await scrapeParticipant(url);
        results.push(data);
        success = true;
        console.log(`    ✅ Sucesso! Status: ${data.status || 'N/A'}, Estalecas: ${data.estalecas || 'N/A'}`);
      } catch (error) {
        const errorMsg = String((error as Error)?.message || error);

        // Só faz retry se for erro de conteúdo não encontrado
        if (errorMsg.includes('Conteúdo principal não encontrado') && attempt < maxRetries) {
          console.log(`    ⚠️  Erro temporário: ${errorMsg}`);
          continue; // Tenta novamente
        } else {
          // Erro definitivo ou última tentativa
          results.push({
            url,
            error: errorMsg
          });
          console.log(`    ❌ Erro${attempt > 1 ? ` (após ${attempt} tentativas)` : ''}: ${errorMsg}`);
          break;
        }
      }
    }

    console.log(`    📊 Progresso: ${current}/${total} (${Math.round((current/total)*100)}%)\n`);
  }

  let successCount = results.filter(r => !('error' in r)).length;
  let errorCount = results.filter(r => 'error' in r).length;

  console.log(`🎉 Primeira rodada concluída!`);
  console.log(`✅ Sucessos: ${successCount}`);
  console.log(`❌ Erros: ${errorCount}`);
  console.log(`📊 Total: ${total}`);

  // 🚨 SISTEMA DE RETRY ADICIONAL: tenta novamente os que falharam (4 vezes cada)
  const failedResults = results.filter(r => 'error' in r) as ScraperError[];
  if (failedResults.length > 0) {
    console.log(`\n🔄 Iniciando retry adicional para ${failedResults.length} participante(s) que falharam...`);
    console.log(`   Cada um será tentado mais 4 vezes.\n`);

    for (let i = 0; i < failedResults.length; i++) {
      const failed = failedResults[i];
      const participantName = extractIdFromUrl(failed.url).replace(/-/g, ' ');
      const current = i + 1;

      console.log(`[${current}/${failedResults.length}] 🔄 Retry: ${participantName}`);
      console.log(`    URL: ${failed.url}`);

      let retrySuccess = false;

      // Tenta 4 vezes para cada participante que falhou
      for (let attempt = 1; attempt <= 4 && !retrySuccess; attempt++) {
        if (attempt > 1) {
          console.log(`    🔄 Tentativa adicional ${attempt}/4 (aguardando 3s...)`);
          await new Promise(resolve => setTimeout(resolve, 3000)); // Espera 3 segundos entre tentativas adicionais
        }

        try {
          const data = await scrapeParticipant(failed.url);

          // Substitui o resultado de erro pelo sucesso
          const failedIndex = results.findIndex(r => 'error' in r && r.url === failed.url);
          if (failedIndex !== -1) {
            results[failedIndex] = data;
          }

          retrySuccess = true;
          successCount++;
          errorCount--;

          console.log(`    ✅ Retry sucesso! Status: ${data.status || 'N/A'}, Estalecas: ${data.estalecas || 'N/A'}`);
        } catch (error) {
          const errorMsg = String((error as Error)?.message || error);

          if (attempt < 4) {
            console.log(`    ⚠️  Retry falhou (${attempt}/4): ${errorMsg}`);
          } else {
            console.log(`    ❌ Retry final falhou: ${errorMsg}`);
          }
        }
      }

      console.log(`    📊 Progresso retry: ${current}/${failedResults.length} (${Math.round((current/failedResults.length)*100)}%)\n`);
    }

    console.log(`🎉 Retry adicional concluído!`);
    console.log(`✅ Sucessos finais: ${successCount}`);
    console.log(`❌ Erros finais: ${errorCount}`);
    console.log(`📈 Taxa de recuperação: ${failedResults.length - errorCount}/${failedResults.length} (${errorCount > 0 ? Math.round(((failedResults.length - errorCount)/failedResults.length)*100) : 100}%)`);
  }

  return results;
}