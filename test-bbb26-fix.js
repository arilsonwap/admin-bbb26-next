const fs = require('fs');

// Teste para verificar se o arquivo bbb26.json agora passa na validação
function testBBB26Validation() {
  console.log('🧪 Testando validação do BBB26 após correção...\n');

  try {
    const content = fs.readFileSync('bbb26.json', 'utf8');
    const data = JSON.parse(content);

    console.log('✅ Arquivo carregado com sucesso');
    console.log(`   Schema: v${data.schemaVersion} | Temporada: BBB${data.season}`);
    console.log(`   Highlights: ${data.highlights.length} | Paredão: ${data.paredao.length} slots\n`);

    // Simular validação dos slots do paredão
    console.log('🔍 Verificando slots do paredão...\n');

    data.paredao.forEach((slot, index) => {
      const slotNum = index + 1;
      console.log(`Slot ${slotNum}:`);
      console.log(`   ID: "${slot.id}" (${typeof slot.id})`);
      console.log(`   participantId: "${slot.participantId || 'undefined'}" (${typeof slot.participantId})`);
      console.log(`   position: ${slot.position} (${typeof slot.position})`);
      console.log(`   status: "${slot.status}" (${typeof slot.status})`);

      // Verificar campos obrigatórios
      const requiredFields = ['id', 'position', 'status'];
      const missingRequired = requiredFields.filter(field => {
        const value = slot[field];
        return value === undefined || value === null;
      });

      if (missingRequired.length > 0) {
        console.log(`   ❌ Faltando campos obrigatórios: ${missingRequired.join(', ')}`);
      } else {
        console.log(`   ✅ Campos obrigatórios OK`);
      }

      // Verificar tipos
      const typeErrors = [];
      if (typeof slot.id !== 'string' || slot.id.trim() === '') {
        typeErrors.push('id deve ser string não vazia');
      }
      if (slot.participantId !== undefined && typeof slot.participantId !== 'string') {
        typeErrors.push('participantId deve ser string ou undefined');
      }
      if (typeof slot.position !== 'number') {
        typeErrors.push('position deve ser number');
      }
      if (typeof slot.status !== 'string') {
        typeErrors.push('status deve ser string');
      }

      if (typeErrors.length > 0) {
        console.log(`   ❌ Erros de tipo: ${typeErrors.join(', ')}`);
      } else {
        console.log(`   ✅ Tipos OK`);
      }

      console.log('');
    });

    console.log('🎉 Validação concluída! O arquivo deve funcionar agora.');

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testBBB26Validation();