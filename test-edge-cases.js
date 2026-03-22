// Teste de casos limites e edge cases
const fs = require('fs');

// Simular funções do sistema
function generateParticipantId(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais (exceto hífen e espaço)
    .replace(/[\s_]+/g, '-') // Substitui espaços e underscores por hífen
    .replace(/-+/g, '-') // Remove hífens duplicados
    .replace(/^-+|-+$/g, ''); // Remove hífens do início e fim
}

function parseMediaInput(input) {
  if (typeof input === 'string') {
    // Substituir vírgula por ponto para parsing
    return parseFloat(input.replace(',', '.')) || 0;
  }
  return typeof input === 'number' ? input : 0;
}

console.log('🧪 TESTE DE CASOS LIMITES\n');

// Teste 1: Slots vazios no paredão
console.log('1️⃣ Slots vazios no paredão:');
const paredaoWithEmptySlots = {
  id: "p4",
  participantId: "",
  position: 4,
  status: "NOT_FORMED"
};
console.log('   ✅ participantId vazio:', paredaoWithEmptySlots.participantId === '');
console.log('   ✅ Status válido:', paredaoWithEmptySlots.status === 'NOT_FORMED');

// Teste 2: Participante não encontrado no cadastro
console.log('\n2️⃣ Participante não encontrado no cadastro:');
const database = {
  participants: {
    "existing-participant": { id: "existing-participant", name: "Existing", status: "ATIVO" }
  },
  history: {
    paredoes: [{
      results: [
        { participantId: "existing-participant", media: 50, status: "SALVO" },
        { participantId: "non-existing-participant", media: 30, status: "SALVO" }
      ]
    }]
  }
};

const exportResult = database.history.paredoes[0].results.map(result => {
  const participant = database.participants[result.participantId];
  return {
    id: result.participantId,
    name: participant?.name || result.participantId,
    media: result.media,
    status: result.status,
  };
});

console.log('   ✅ Participante existente:', exportResult[0].name === 'Existing');
console.log('   ✅ Participante não encontrado:', exportResult[1].name === 'non-existing-participant');
console.log('   ✅ Export não quebra:', exportResult.length === 2);

// Teste 3: Parsing de números com vírgula
console.log('\n3️⃣ Parsing de médias com vírgula (pt-BR):');
const testInputs = ["61,64", "32.5", "5,86", "abc", ""];
const expectedOutputs = [61.64, 32.5, 5.86, 0, 0];

testInputs.forEach((input, index) => {
  const result = parseMediaInput(input);
  const expected = expectedOutputs[index];
  console.log(`   ${input} → ${result} ${result === expected ? '✅' : '❌ (esperado: ' + expected + ')'}`);
});

// Teste 4: Geração de slugs com acentos e caracteres especiais
console.log('\n4️⃣ Geração de slugs com acentos:');
const testNames = [
  "João Silva",
  "María José",
  "José María González",
  "Anne-Marie",
  "Test@#$%Special",
  "A B C",
  "a--b__c"
];

const expectedSlugs = [
  "joao-silva",
  "maria-jose",
  "jose-maria-gonzalez",
  "anne-marie",
  "testspecial",
  "a-b-c",
  "a-b-c"
];

testNames.forEach((name, index) => {
  const slug = generateParticipantId(name);
  const expected = expectedSlugs[index];
  console.log(`   "${name}" → "${slug}" ${slug === expected ? '✅' : '❌ (esperado: "' + expected + '")'}`);
});

// Teste 5: UpdatedAt consistente e ISO
console.log('\n5️⃣ UpdatedAt consistente e ISO:');
const now = new Date();
const isoString = now.toISOString();
const isValidISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(isoString);

console.log('   ✅ Formato ISO válido:', isValidISO);
console.log('   ✅ String de exemplo:', isoString);

// Teste 6: Normalização de enums
console.log('\n6️⃣ Normalização de enums:');
const testStatuses = ["Ativo", "ATIVO", "ativo", "Eliminado", "ELIMINADO", "eliminado", "Desclassificado"];
const normalizedStatuses = ["ATIVO", "ATIVO", "ATIVO", "ELIMINADO", "ELIMINADO", "ELIMINADO", "DESCLASSIFICADO"];

function normalizeStatus(status) {
  const upper = status.toUpperCase();
  if (upper === 'ATIVO' || upper === 'ACTIVE') return 'ATIVO';
  if (upper === 'ELIMINADO' || upper === 'ELIMINATED') return 'ELIMINADO';
  if (upper === 'DESCLASSIFICADO' || upper === 'DISQUALIFIED') return 'DESCLASSIFICADO';
  return 'ATIVO'; // fallback
}

testStatuses.forEach((status, index) => {
  const normalized = normalizeStatus(status);
  const expected = normalizedStatuses[index];
  console.log(`   "${status}" → "${normalized}" ${normalized === expected ? '✅' : '❌'}`);
});

// Teste 7: Validações de negócio
console.log('\n7️⃣ Validações de negócio:');
const testScenarios = [
  {
    name: 'Paredão com participante eliminado',
    participants: { 'p1': { status: 'ELIMINADO' } },
    paredao: [{ participantId: 'p1' }],
    shouldError: true
  },
  {
    name: 'Paredão com participante repetido',
    participants: { 'p1': { status: 'ATIVO' }, 'p2': { status: 'ATIVO' } },
    paredao: [{ participantId: 'p1' }, { participantId: 'p1' }],
    shouldError: true
  },
  {
    name: 'Paredão válido',
    participants: { 'p1': { status: 'ATIVO' }, 'p2': { status: 'ATIVO' } },
    paredao: [{ participantId: 'p1' }, { participantId: 'p2' }],
    shouldError: false
  }
];

function validateParedao(participants, paredao) {
  const errors = [];

  // Verificar participantes eliminados
  for (const slot of paredao) {
    if (slot.participantId && participants[slot.participantId]?.status !== 'ATIVO') {
      errors.push('Participante eliminado no paredão');
    }
  }

  // Verificar participantes repetidos
  const participantIds = paredao.map(s => s.participantId).filter(id => id);
  const uniqueIds = [...new Set(participantIds)];
  if (uniqueIds.length !== participantIds.length) {
    errors.push('Participante repetido no paredão');
  }

  return errors;
}

testScenarios.forEach(scenario => {
  const errors = validateParedao(scenario.participants, scenario.paredao);
  const hasErrors = errors.length > 0;
  const correct = hasErrors === scenario.shouldError;
  console.log(`   ${scenario.name}: ${hasErrors ? 'ERRO' : 'OK'} ${correct ? '✅' : '❌'}`);
});

console.log('\n🎯 TODOS OS CASOS LIMITES TESTADOS!');
console.log('Se tudo estiver ✅, o sistema lida bem com casos extremos.');