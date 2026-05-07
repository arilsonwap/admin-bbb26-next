import generator from '../src/lib/casaDoPatraoConteudosGenerator.cjs';

const { generateCasaDoPatraoConteudos } = generator;

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`[casa-do-patrao-conteudos] Início: ${startedAt}`);

  const result = await generateCasaDoPatraoConteudos(process.cwd());

  console.log(`[casa-do-patrao-conteudos] Itens extraídos da fonte: ${result.incomingCount}`);
  console.log(`[casa-do-patrao-conteudos] Itens após merge: ${result.mergedCount}`);
  console.log(`[casa-do-patrao-conteudos] Itens gravados (limite 100): ${result.writtenCount}`);
  console.log(`[casa-do-patrao-conteudos] Novos itens nesta execução: ${result.addedCount}`);
  console.log('[casa-do-patrao-conteudos] Arquivos atualizados:');
  console.log('- tools/bbb-hosting/public/casa-do-patrao-conteudos.json');
  console.log('- tools/bbb-hosting/public/casa-do-patrao-conteudos-latest.json');
  console.log(`[casa-do-patrao-conteudos] Fim: ${new Date().toISOString()}`);
}

main().catch((err) => {
  console.error('[casa-do-patrao-conteudos] Erro:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
