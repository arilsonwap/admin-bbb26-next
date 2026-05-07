#!/usr/bin/env node

// 🎯 QUERIES PRÁTICAS PARA ANALISAR DADOS DO QUERIDÔMETRO BBB
// Execute com: node QUERIES-EXEMPLO.js

import fs from 'fs';

// 📥 Carregar dados mais recentes
function carregarDadosMaisRecentes() {
  const arquivos = fs.readdirSync('data')
    .filter(f => f.startsWith('queridometro-'))
    .sort()
    .reverse();

  if (arquivos.length === 0) {
    console.error('❌ Nenhum arquivo de dados encontrado!');
    process.exit(1);
  }

  const arquivoMaisRecente = arquivos[0];
  console.log(`📂 Carregando: ${arquivoMaisRecente}`);

  const dados = JSON.parse(fs.readFileSync(`data/${arquivoMaisRecente}`, 'utf8'));
  console.log(`📊 ${dados.length} participantes carregados\n`);

  return dados;
}

// 🧮 Funções de Análise
function contarEmojis(participante) {
  const contagem = {};
  participante.received.forEach(reacao => {
    contagem[reacao.emoji] = (contagem[reacao.emoji] || 0) + 1;
  });
  return contagem;
}

function indicePopularidade(participante) {
  const contagem = contarEmojis(participante);
  const positivo = contagem.coracao || 0;
  const negativo = (contagem.cobra || 0) + (contagem.alvo || 0) +
                   (contagem.mala || 0) + (contagem.vomito || 0) +
                   (contagem.mentiroso || 0);
  return positivo - negativo;
}

function fatorRisco(participante) {
  const contagem = contarEmojis(participante);
  return (contagem.alvo || 0) + (contagem.mala || 0) +
         (contagem.vomito || 0) + (contagem.cobra || 0);
}

function nomeParticipante(participante) {
  return participante.pageUrl.split('/').filter(Boolean).pop();
}

// 📊 QUERIES PRINCIPAIS

function rankingPopularidade(dados) {
  console.log('🏆 RANKING DE POPULARIDADE\n');

  const ranking = dados.map(p => ({
    nome: nomeParticipante(p),
    popularidade: indicePopularidade(p),
    reacoes: p.received.length
  })).sort((a, b) => b.popularidade - a.popularidade);

  ranking.forEach((p, i) => {
    const medalha = i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i+1}.`;
    console.log(`${medalha} ${p.nome}: ${p.popularidade > 0 ? '+' : ''}${p.popularidade} (${p.reacoes} reações)`);
  });
  console.log();
}

function participantesMaisArriscados(dados) {
  console.log('🚨 PARTICIPANTES MAIS ARRISCADOS (ALTO RISCO)\n');

  const ranking = dados.map(p => ({
    nome: nomeParticipante(p),
    risco: fatorRisco(p),
    popularidade: indicePopularidade(p),
    alvos: contarEmojis(p).alvo || 0,
    malas: contarEmojis(p).mala || 0
  })).filter(p => p.risco > 5)
    .sort((a, b) => b.risco - a.risco);

  if (ranking.length === 0) {
    console.log('✅ Nenhum participante em alto risco!\n');
    return;
  }

  ranking.forEach((p, i) => {
    console.log(`${i+1}. ${p.nome}: ${p.risco} pontos de risco`);
    console.log(`   🎯 ${p.alvos} alvos + 💼 ${p.malas} malas | Popularidade: ${p.popularidade > 0 ? '+' : ''}${p.popularidade}`);
  });
  console.log();
}

function mapaAliancas(dados) {
  console.log('🤝 MAPA DE ALIANÇAS (TOP 5)\n');

  // Conta quem dá mais ❤️
  const doadoresCoracao = {};
  dados.forEach(p => {
    p.received.forEach(r => {
      if (r.emoji === 'coracao') {
        doadoresCoracao[r.fromName] = (doadoresCoracao[r.fromName] || 0) + 1;
      }
    });
  });

  const topDoadores = Object.entries(doadoresCoracao)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  topDoadores.forEach(([nome, qtd], i) => {
    console.log(`${i+1}. ${nome}: ${qtd} ❤️ enviados`);
  });
  console.log();
}

function alvosMaisCitados(dados) {
  console.log('🎯 PARTICIPANTES MAIS CITADOS COMO ALVO (QUEM RECEBEU MAIS 🎯)\n');

  const alvos = {};
  dados.forEach(p => {
    p.received.forEach(r => {
      if (r.emoji === 'alvo') {
        alvos[r.fromName] = (alvos[r.fromName] || 0) + 1;
      }
    });
  });

  const topAlvos = Object.entries(alvos)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  if (topAlvos.length === 0) {
    console.log('✅ Nenhum alvo identificado!\n');
    return;
  }

  topAlvos.forEach(([nome, qtd], i) => {
    console.log(`${i+1}. ${nome}: ${qtd} indicações de alvo`);
  });
  console.log();
}

function analiseIndividual(dados, nomeProcurado) {
  const participante = dados.find(p =>
    nomeParticipante(p).toLowerCase().includes(nomeProcurado.toLowerCase())
  );

  if (!participante) {
    console.log(`❌ Participante "${nomeProcurado}" não encontrado!\n`);
    return;
  }

  const nome = nomeParticipante(participante);
  const contagem = contarEmojis(participante);
  const popularidade = indicePopularidade(participante);
  const risco = fatorRisco(participante);

  console.log(`👤 ANÁLISE INDIVIDUAL: ${nome.toUpperCase()}\n`);

  console.log(`📊 Estatísticas Gerais:`);
  console.log(`   Total de reações: ${participante.received.length}`);
  console.log(`   Índice de popularidade: ${popularidade > 0 ? '+' : ''}${popularidade}`);
  console.log(`   Fator de risco: ${risco} (risco ${risco > 10 ? 'ALTO' : risco > 5 ? 'MÉDIO' : 'BAIXO'})`);

  console.log(`\n🎯 Emojis recebidos:`);
  Object.entries(contagem).forEach(([emoji, qtd]) => {
    console.log(`   ${emoji}: ${qtd}`);
  });

  console.log(`\n🤝 Principais aliados (quem deu ❤️):`);
  const aliados = participante.received
    .filter(r => r.emoji === 'coracao')
    .map(r => r.fromName);

  if (aliados.length === 0) {
    console.log('   Nenhum aliado identificado');
  } else {
    aliados.forEach(aliado => console.log(`   ❤️ ${aliado}`));
  }

  console.log(`\n🚨 Principais críticos (quem deu 🎯 ou 💼):`);
  const criticos = participante.received
    .filter(r => r.emoji === 'alvo' || r.emoji === 'mala')
    .map(r => `${r.fromName} (${r.emoji})`);

  if (criticos.length === 0) {
    console.log('   Nenhum crítico identificado');
  } else {
    criticos.forEach(critico => console.log(`   ⚠️ ${critico}`));
  }

  console.log();
}

// 🚀 EXECUÇÃO PRINCIPAL
function main() {
  const dados = carregarDadosMaisRecentes();

  // Executar todas as análises
  rankingPopularidade(dados);
  participantesMaisArriscados(dados);
  mapaAliancas(dados);
  alvosMaisCitados(dados);

  // Análise individual de exemplo (modifique o nome)
  analiseIndividual(dados, 'solange');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  carregarDadosMaisRecentes,
  rankingPopularidade,
  participantesMaisArriscados,
  mapaAliancas,
  alvosMaisCitados,
  analiseIndividual,
  contarEmojis,
  indicePopularidade,
  fatorRisco
};
