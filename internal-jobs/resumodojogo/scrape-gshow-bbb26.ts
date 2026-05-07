#!/usr/bin/env ts-node

import { writeFileSync } from "fs";
import { scrapeMultipleParticipants } from "./services/gshowScraper";

function getFormattedDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function main() {
  const args = process.argv.slice(2);

  if (!args.length) {
    console.error("Uso: ts-node scrape-gshow-bbb26.ts <url1> [url2] ... [--output arquivo.json]");
    console.error("Exemplo: ts-node scrape-gshow-bbb26.ts \"https://gshow.globo.com/realities/bbb/bbb-26/participantes/alberto-cowboy/\"");
    console.error("Nota: Por padrão, os dados são salvos em 'statusbbb-YYYY-MM-DD.json'");
    process.exit(1);
  }

  // Separar URLs dos argumentos de opção
  const urls: string[] = [];
  const dataBusca = getFormattedDate();
  let outputFile: string = 'statusbbb.json'; // Nome padrão sem data

  let i = 0;
  while (i < args.length) {
    if (args[i] === '--output') {
      if (i + 1 < args.length) {
        outputFile = args[i + 1];
        i += 2; // Pular ambos os argumentos
      } else {
        console.error("Erro: --output requer um nome de arquivo");
        process.exit(1);
      }
    } else {
      urls.push(args[i]);
      i++;
    }
  }

  if (!urls.length) {
    console.error("Nenhuma URL fornecida!");
    process.exit(1);
  }

  try {
    console.log(`Iniciando scraping de ${urls.length} participante(s)...`);
    const results = await scrapeMultipleParticipants(urls);

    const outputData = results.length === 1 ? results[0] : results;
    const dataComTimestamp = {
      dataBusca,
      participantes: outputData
    };

    const jsonString = JSON.stringify(dataComTimestamp, null, 2);

    writeFileSync(outputFile, jsonString, 'utf8');
    console.log(`✅ Dados salvos em: ${outputFile}`);
    console.log(`📅 Data da busca: ${dataBusca}`);
    console.log(`📊 ${results.length} participante(s) processado(s)`);

  } catch (error) {
    console.error("Erro fatal:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}