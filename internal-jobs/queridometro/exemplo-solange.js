import { chromium } from "playwright";
import fs from "fs";

const url = "https://gshow.globo.com/realities/bbb/bbb-26/participantes/solange-couto/";

function yyyy_mm_dd() {
  return new Date().toISOString().slice(0, 10);
}

async function extract(page) {
  return await page.evaluate(() => {
    const root = document.querySelector("section.post-queridometro-tabs");
    if (!root) return null;

    // Counters (totais)
    const counters = [...root.querySelectorAll(".post-queridometro-counter-item")]
      .map(item => {
        const emoji = item.querySelector("img[alt]")?.getAttribute("alt")?.trim() || null;
        const count = parseInt(
          item.querySelector(".post-queridometro-counter-item__count")?.textContent?.trim() || "0",
          10
        );
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
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Aumentar timeout da página
  page.setDefaultTimeout(60000);

  console.log(`Carregando: ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  // Aguardar um pouco mais para garantir que o conteúdo dinâmico carregue
  await page.waitForTimeout(3000);

  const data = await extract(page);
  await browser.close();

  if (!data) {
    console.error("Não achei o bloco do Queridômetro na página.");
    process.exit(1);
  }

  const out = {
    date: yyyy_mm_dd(),
    pageUrl: url,
    tab: "Recebidos",
    ...data,
  };

  fs.mkdirSync("data", { recursive: true });
  const file = `data/queridometro-solange-couto-${out.date}.json`;
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log("Salvo:", file);

  // Exemplo: imprimir quem deu todos os emojis
  console.log("Coração:", out.porEmoji.coracao || []);
  console.log("Coração Partido:", out.porEmoji.coracao_partido || []);
  console.log("Mala:", out.porEmoji.mala || []);
  console.log("Planta:", out.porEmoji.planta || []);
  console.log("Vômito:", out.porEmoji.vomito || []);
  console.log("Alvo:", out.porEmoji.alvo || []);
  console.log("Biscoito:", out.porEmoji.biscoito || []);
  console.log("Cobra:", out.porEmoji.cobra || []);
  console.log("Mentiroso:", out.porEmoji.mentiroso || []);
})();
