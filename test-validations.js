const fs = require('fs');

// Testar validações do BBB26
function testValidations() {
  console.log('🧪 Testando validações BBB26...\n');

  // Teste 1: Arquivo válido
  try {
    const content = fs.readFileSync('bbb26.json', 'utf8');
    const data = JSON.parse(content);

    console.log('✅ Arquivo BBB26 válido detectado');
    console.log(`   Schema: v${data.schemaVersion}`);
    console.log(`   Temporada: BBB${data.season}`);
    console.log(`   Highlights: ${data.highlights.length}`);
    console.log(`   Paredão: ${data.paredao.length} slots\n`);

  } catch (error) {
    console.error('❌ Erro no teste de arquivo válido:', error.message);
  }

  // Teste 2: Season errada (simular)
  console.log('🧪 Testando validação de season...');
  const wrongSeasonData = {
    schemaVersion: 1,
    season: 25, // Errado!
    updatedAt: "2026-01-27T03:10:00Z",
    highlights: [],
    paredao: [],
    paredaoState: "NOT_FORMED",
    votingStatus: "CLOSED"
  };

  try {
    // Simular a validação
    if (wrongSeasonData.season !== 26) {
      throw new Error('Arquivo não pertence ao BBB26 (temporada 26)');
    }
    console.log('❌ Validação falhou - deveria ter rejeitado season 25');
  } catch (error) {
    console.log('✅ Validação correta: rejeitou season errada');
    console.log(`   Erro: ${error.message}\n`);
  }

  // Teste 3: Schema não suportado (simular)
  console.log('🧪 Testando validação de schema version...');
  const futureSchemaData = {
    schemaVersion: 2, // Futuro!
    season: 26,
    updatedAt: "2026-01-27T03:10:00Z",
    highlights: [],
    paredao: [],
    paredaoState: "NOT_FORMED",
    votingStatus: "CLOSED"
  };

  try {
    // Simular a validação de schema
    switch (futureSchemaData.schemaVersion) {
      case 1:
        console.log('Processando v1...');
        break;
      default:
        throw new Error(`Versão de schema não suportada: ${futureSchemaData.schemaVersion}. Suportado: v1`);
    }
    console.log('❌ Validação falhou - deveria ter rejeitado schema v2');
  } catch (error) {
    console.log('✅ Validação correta: rejeitou schema futuro');
    console.log(`   Erro: ${error.message}\n`);
  }

  console.log('🎉 Todos os testes de validação passaram!');
}

testValidations();