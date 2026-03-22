const fs = require('fs');

// Simular a função importFromBBB26
function testImport() {
  try {
    const content = fs.readFileSync('bbb26.json', 'utf8');
    const data = JSON.parse(content);

    console.log('Arquivo lido com sucesso!');
    console.log('Estrutura:', {
      schemaVersion: data.schemaVersion,
      season: data.season,
      hasHighlights: !!data.highlights,
      hasParedao: !!data.paredao,
      paredaoState: data.paredaoState,
      votingStatus: data.votingStatus
    });

    console.log('Highlights:', data.highlights.length);
    console.log('Paredao slots:', data.paredao.length);

  } catch (error) {
    console.error('Erro:', error.message);
  }
}

testImport();