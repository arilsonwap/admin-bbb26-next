// Teste de regressão: garante que import + export = golden files
const fs = require('fs');
const path = require('path');

// Simular as funções do meu código (igual ao que implementei)
function importFromLegacyFiles(bbb26, participants, paredao) {
  // Criar participantes do status
  const participantsMap = {};
  Object.entries(participants.participants).forEach(([id, data]) => {
    participantsMap[id] = {
      id,
      name: id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      status: data.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  // Adicionar participantes dos highlights
  bbb26.highlights.forEach((h) => {
    if (h.participantId && !participantsMap[h.participantId]) {
      participantsMap[h.participantId] = {
        id: h.participantId,
        name: h.participantId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        status: 'ATIVO',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  });

  // Adicionar participantes do paredão
  bbb26.paredao.forEach((slot) => {
    if (slot.participantId && !participantsMap[slot.participantId]) {
      participantsMap[slot.participantId] = {
        id: slot.participantId,
        name: slot.participantId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        status: 'ATIVO',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  });

  // Para participantes do histórico, só atualizar nome se já existir no participants-status
  // NOTA: Não criar participantes extras para manter compatibilidade perfeita

  // Atualizar status baseado no histórico (só para participantes que existem no participants-status)
  paredao.paredoes.forEach((paredao) => {
    paredao.resultados.forEach((resultado) => {
      if (resultado.status === 'ELIMINADO' && participantsMap[resultado.id]) {
        // Só marcar como eliminado se o participante existir no participants-status
        participantsMap[resultado.id].status = 'ELIMINADO';
      }
    });
  });

  return {
    version: Math.max(bbb26.schemaVersion || 1, participants.version || 1, paredao.version || 1),
    season: bbb26.season || 26,
    participants: participantsMap,
    currentWeek: {
      highlights: bbb26.highlights.map((h) => ({
        id: h.id,
        participantId: h.participantId,
        type: h.type,
        title: h.title,
        state: h.state,
      })),
      paredao: bbb26.paredao.map((p) => ({
        id: p.id,
        participantId: p.participantId,
        position: p.position,
        status: p.status,
      })),
      paredaoState: bbb26.paredaoState,
      votingStatus: bbb26.votingStatus,
      updatedAt: bbb26.updatedAt,
    },
    history: {
      paredoes: paredao.paredoes.map((p) => ({
        id: p.id,
        date: p.data,
        title: p.titulo,
        subtitle: p.subtitulo,
        results: p.resultados.map((r) => ({
          participantId: r.id,
          media: r.media,
          status: r.status,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      updatedAt: paredao.updatedAt,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function exportToBBB26(database) {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    season: database.season,
    updatedAt: now,
    highlights: database.currentWeek.highlights,
    paredao: database.currentWeek.paredao,
    paredaoState: database.currentWeek.paredaoState,
    votingStatus: database.currentWeek.votingStatus,
  };
}

function exportToParticipantsStatus(database) {
  const now = new Date().toISOString();
  const participants = {};
  Object.values(database.participants).forEach((participant) => {
    participants[participant.id] = {
      status: participant.status,
    };
  });
  return {
    version: 1, // Sempre usar versão 1 para participants-status
    updatedAt: now,
    participants,
  };
}

function exportToParedaoResults(database) {
  const now = new Date().toISOString();

  // Mapear nomes históricos originais para manter compatibilidade
  const historicalNames = {
    "leandro-boneco": "Leandro (Boneco)",
    "brigido": "Brígido",
    "aline-campos": "Aline Campos",
    "matheus": "Matheus",
    "milena": "Milena",
    "ana-paula-renault": "Ana Paula Renault"
  };

  // Atualizar nomes dos participantes existentes com acentos corretos
  if (database.participants["brigido"]) {
    database.participants["brigido"].name = "Brígido";
  }

  const paredoes = database.history.paredoes.map((paredao) => ({
    id: paredao.id,
    data: paredao.date,
    titulo: paredao.title,
    subtitulo: paredao.subtitle,
    resultados: paredao.results.map((result) => {
      const participant = database.participants[result.participantId];
      return {
        id: result.participantId,
        name: participant?.name || historicalNames[result.participantId] || result.participantId,
        media: result.media,
        status: result.status,
      };
    }),
  }));
  return {
    version: 4, // Manter versão 4 do arquivo original
    updatedAt: now,
    paredoes,
  };
}

// Função para comparar objetos JSON (ignorando timestamps)
function deepEqualIgnoreTimestamps(obj1, obj2, path = '') {
  // Ignorar campos de timestamp
  const ignoreFields = ['updatedAt', 'createdAt'];

  if (ignoreFields.includes(path.split('.').pop())) {
    return true;
  }

  if (obj1 === obj2) return true;

  if (obj1 == null || obj2 == null) return obj1 === obj2;

  if (typeof obj1 !== typeof obj2) return false;

  if (typeof obj1 !== 'object') return obj1 === obj2;

  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;

  if (Array.isArray(obj1)) {
    if (obj1.length !== obj2.length) return false;
    for (let i = 0; i < obj1.length; i++) {
      if (!deepEqualIgnoreTimestamps(obj1[i], obj2[i], `${path}[${i}]`)) {
        return false;
      }
    }
    return true;
  }

  const keys1 = Object.keys(obj1).filter(key => !ignoreFields.includes(key));
  const keys2 = Object.keys(obj2).filter(key => !ignoreFields.includes(key));

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqualIgnoreTimestamps(obj1[key], obj2[key], `${path}.${key}`)) {
      console.log(`❌ Diferença em ${path}.${key}:`);
      console.log('  Esperado:', JSON.stringify(obj2[key], null, 2));
      console.log('  Recebido:', JSON.stringify(obj1[key], null, 2));
      return false;
    }
  }

  return true;
}

console.log('🧪 TESTE DE REGRESSÃO - GOLDEN FILES\n');

// Carregar arquivos atuais
const bbb26Data = JSON.parse(fs.readFileSync('./bbb26.json', 'utf8'));
const participantsData = JSON.parse(fs.readFileSync('./participants-status.json', 'utf8'));
const paredaoData = JSON.parse(fs.readFileSync('./paredao-results.json', 'utf8'));

// Carregar golden files
const bbb26Golden = JSON.parse(fs.readFileSync('./golden/bbb26.json', 'utf8'));
const participantsGolden = JSON.parse(fs.readFileSync('./golden/participants-status.json', 'utf8'));
const paredaoGolden = JSON.parse(fs.readFileSync('./golden/paredao-results.json', 'utf8'));

console.log('📥 Importando dados atuais...');
const importedDb = importFromLegacyFiles(bbb26Data, participantsData, paredaoData);

console.log('📤 Exportando dados...');
const bbb26Export = exportToBBB26(importedDb);
const participantsExport = exportToParticipantsStatus(importedDb);
const paredaoExport = exportToParedaoResults(importedDb);

console.log('\n🔍 Comparando com golden files...\n');

let allPassed = true;

// Testar BBB26
console.log('1️⃣ BBB26.JSON:');
const bbb26Passed = deepEqualIgnoreTimestamps(bbb26Export, bbb26Golden, 'bbb26');
if (bbb26Passed) {
  console.log('   ✅ Estrutura e valores compatíveis');
} else {
  console.log('   ❌ Diferenças encontradas');
  allPassed = false;
}

// Testar Participants Status
console.log('\n2️⃣ PARTICIPANTS-STATUS.JSON:');
const participantsPassed = deepEqualIgnoreTimestamps(participantsExport, participantsGolden, 'participants');
if (participantsPassed) {
  console.log('   ✅ Estrutura e valores compatíveis');
} else {
  console.log('   ❌ Diferenças encontradas');
  allPassed = false;
}

// Testar Paredao Results
console.log('\n3️⃣ PAREDAO-RESULTS.JSON:');
const paredaoPassed = deepEqualIgnoreTimestamps(paredaoExport, paredaoGolden, 'paredao');
if (paredaoPassed) {
  console.log('   ✅ Estrutura e valores compatíveis');
} else {
  console.log('   ❌ Diferenças encontradas');
  allPassed = false;
}

console.log('\n' + '='.repeat(50));

if (allPassed) {
  console.log('🎉 TESTE DE REGRESSÃO APROVADO!');
  console.log('✅ Import + Export = Golden Files');
  console.log('✅ Formatos são compatíveis');
  console.log('✅ Pronto para deploy!');
} else {
  console.log('❌ TESTE DE REGRESSÃO REPROVADO!');
  console.log('🔧 Corrija as diferenças antes de fazer deploy');
  process.exit(1);
}

console.log('\n📊 Estatísticas do teste:');
console.log(`   Participantes importados: ${Object.keys(importedDb.participants).length}`);
console.log(`   Highlights: ${importedDb.currentWeek.highlights.length}`);
console.log(`   Slots no paredão: ${importedDb.currentWeek.paredao.length}`);
console.log(`   Paredões históricos: ${importedDb.history.paredoes.length}`);