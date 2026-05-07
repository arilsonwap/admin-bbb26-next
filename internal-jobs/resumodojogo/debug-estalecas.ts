#!/usr/bin/env ts-node

import { chromium } from "playwright";

async function debugEstalecas(url: string) {
  console.log(`\n🔍 Testando extração de estalecas para: ${url}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    locale: "pt-BR",
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
  });

  try {
    console.log("📄 Carregando página...");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Espera o main aparecer
    await page.locator("main").waitFor({ timeout: 10000 }).catch(() => {
      console.log("⚠️  Main não encontrado, continuando mesmo assim...");
    });

    await page.waitForTimeout(1000);

    console.log("🔢 Extraindo estalecas...");

    const result = await page.evaluate(() => {
      function parsePtNumber(raw: string): number | null {
        const s = (raw || "")
          .trim()
          .replace(/\u00a0/g, " ")
          .replace(/\s+/g, " ");

        // Primeiro tenta extrair apenas números do texto (ex: "Estalecas1450" -> "1450")
        const numOnly = s.replace(/[^\d.,+-]/g, ""); // remove tudo exceto números, pontos, vírgulas, sinais

        // Se não encontrou números, tenta o texto original
        const target = numOnly || s;

        // DEBUG: log dos passos
        logs.push(`🔢 parsePtNumber("${s}") -> numOnly: "${numOnly}" -> target: "${target}"`);

        // aceita: -150, +150, 150, -1.500, 1.500
        // (se vier com vírgula, também funciona: -1.500,50 -> vira -1500.50)
        const m = target.match(/^[+-]?\d{1,3}(\.\d{3})*(,\d+)?$|^[+-]?\d+(,\d+)?$/);
        logs.push(`  Regex match: ${m ? 'SIM' : 'NÃO'} (${m ? m[0] : 'null'})`);

        if (!m) return null;

        const normalized = target.replace(/\./g, "").replace(",", ".");
        const n = Number(normalized);
        logs.push(`  Normalized: "${normalized}" -> Number: ${n} -> isFinite: ${Number.isFinite(n)}`);

        return Number.isFinite(n) ? n : null;
      }

      const logs: string[] = [];

      // 1) Elemento semântico
      let el: Element | null =
        document.querySelector('[data-testid*="estaleca" i]') ||
        document.querySelector('[class*="estaleca" i]') ||
        null;

      logs.push(`🔍 Elemento semântico: ${el ? el.tagName + (el.className ? '.' + el.className : '') : 'NÃO ENCONTRADO'}`);

      // 2) Fallback com spans
      if (!el) {
        const spans = Array.from(document.querySelectorAll("span"));
        logs.push(`📊 Total de spans encontrados: ${spans.length}`);

        // DEBUG: mostra TODOS os spans para entender os formatos
        logs.push("🔍 TODOS os spans encontrados (primeiros 20):");
        spans.slice(0, 20).forEach((span, i) => {
          const text = (span.textContent || "").trim();
          const parentText = (span.parentElement?.textContent || "").toLowerCase().substring(0, 50);
          logs.push(`  ${i+1}. "${text}" (parent: "...${parentText}...")`);
        });

        const candidates = spans
          .map((span) => ({ span, text: (span.textContent || "").trim() }))
          .map((x) => ({ ...x, value: parsePtNumber(x.text) }))
          .filter((x) => x.value !== null) as Array<{ span: HTMLSpanElement; text: string; value: number }>;

        logs.push(`✅ Candidatos válidos (números): ${candidates.length}`);

        if (candidates.length > 0) {
          logs.push("📋 Lista de candidatos:");
          candidates.slice(0, 10).forEach((c, i) => {
            const parentText = (c.span.parentElement?.textContent || "").toLowerCase().substring(0, 100);
            logs.push(`  ${i+1}. "${c.text}" -> ${c.value} (parent: "...${parentText}...")`);
          });
        }

        // Heurística
        const scored = candidates.map((c) => {
          const parentText = (c.span.parentElement?.textContent || "").toLowerCase();
          const score =
            (parentText.includes("estaleca") ? 10 : 0) +
            (parentText.includes("est") ? 1 : 0) +
            Math.min(3, Math.floor(Math.abs(c.value) / 1000));
          return { ...c, score };
        });

        scored.sort((a, b) => b.score - a.score);

        logs.push("🏆 Candidatos ordenados por score:");
        scored.slice(0, 5).forEach((c, i) => {
          logs.push(`  ${i+1}. "${c.text}" (score: ${c.score})`);
        });

        el = scored[0]?.span || null;
      }

      const raw = (el?.textContent || "").trim();
      const n = parsePtNumber(raw);

      logs.push(`🎯 Resultado final: "${raw}" -> ${n}`);

      return { value: n, logs };
    });

    console.log("\n" + "=".repeat(50));
    result.logs.forEach(log => console.log(log));
    console.log("=".repeat(50));

    console.log(`\n📊 RESULTADO: Estalecas = ${result.value || 'NÃO ENCONTRADO'}`);

  } catch (error) {
    console.error("❌ Erro:", error);
  } finally {
    await browser.close();
  }
}

// Testa com alguns participantes
async function main() {
  const urls = [
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/jonas-sulzbach/",
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/gabriela/",
    "https://gshow.globo.com/realities/bbb/bbb-26/participantes/breno/"
  ];

  for (const url of urls) {
    await debugEstalecas(url);
    console.log("\n" + "-".repeat(80) + "\n");
  }
}

if (require.main === module) {
  main();
}