# 📊 Análise Prática dos Dados do Queridômetro BBB

## 🎯 Como Interpretar os Dados Coletados

### Estrutura Básica dos Dados
```json
[
  {
    "date": "2026-01-25",
    "pageUrl": "https://gshow.globo.com/realities/bbb/bbb-26/participantes/solange-couto/",
    "tab": "Recebidos",
    "received": [
      {
        "fromName": "Breno",
        "emoji": "coracao",
        "profileUrl": "https://gshow.globo.com/realities/bbb/bbb-26/participantes/breno/"
      },
      {
        "fromName": "Marcelo",
        "emoji": "alvo",
        "profileUrl": "https://gshow.globo.com/realities/bbb/bbb-26/participantes/marcelo/"
      }
    ]
  }
]
```

## 🧮 Cálculos Estratégicos

### 1. Contagem Total por Emoji
```javascript
// Para um participante específico
function contarEmojis(participante) {
  const contagem = {};

  participante.received.forEach(reacao => {
    contagem[reacao.emoji] = (contagem[reacao.emoji] || 0) + 1;
  });

  return contagem;
}

// Exemplo: { coracao: 15, alvo: 3, cobra: 2, planta: 5 }
```

### 2. Índice de Popularidade
```javascript
function indicePopularidade(participante) {
  const contagem = contarEmojis(participante);

  const positivo = contagem.coracao || 0;
  const negativo = (contagem.cobra || 0) + (contagem.alvo || 0) +
                   (contagem.mala || 0) + (contagem.vomito || 0) +
                   (contagem.mentiroso || 0);

  return positivo - negativo;
}

// Interpretação:
// > 10: Muito popular
// 0-10: Popular/neutro
// < 0: Impopular/ameaçado
```

### 3. Fator de Risco de Eliminação
```javascript
function fatorRisco(participante) {
  const contagem = contarEmojis(participante);

  return (contagem.alvo || 0) + (contagem.mala || 0) +
         (contagem.vomito || 0) + (contagem.cobra || 0);
}

// Interpretação:
// < 5: Baixo risco
// 5-10: Médio risco
// > 10: Alto risco (provável paredão)
```

### 4. Análise de Alianças
```javascript
function analisarAliancas(dados, nomeParticipante) {
  const participante = dados.find(p => p.pageUrl.includes(nomeParticipante));
  if (!participante) return null;

  const alianças = {
    aliados: [],
    traidores: [],
    alvos: [],
    neutros: []
  };

  participante.received.forEach(reacao => {
    if (reacao.emoji === 'coracao') {
      alianças.aliados.push(reacao.fromName);
    } else if (reacao.emoji === 'cobra' || reacao.emoji === 'mentiroso') {
      alianças.traidores.push(reacao.fromName);
    } else if (reacao.emoji === 'alvo' || reacao.emoji === 'mala') {
      alianças.alvos.push(reacao.fromName);
    } else {
      alianças.neutros.push(reacao.fromName);
    }
  });

  return alianças;
}
```

## 📈 Exemplos de Análise Real

### Exemplo 1: Participante Estratégico
```javascript
// Dados hipotéticos de um jogador
const jogador = {
  received: [
    { fromName: "Aliado1", emoji: "coracao" },
    { fromName: "Aliado2", emoji: "coracao" },
    { fromName: "Aliado3", emoji: "coracao" },
    { fromName: "Concorrente1", emoji: "alvo" },
    { fromName: "Concorrente2", emoji: "cobra" },
    { fromName: "Neutro1", emoji: "planta" },
    { fromName: "Neutro2", emoji: "biscoito" }
  ]
};

const popularidade = indicePopularidade({ received: jogador.received });
// Resultado: 3 - 2 = 1 (população moderada)
```

### Exemplo 2: Participante em Risco
```javascript
const emRisco = {
  received: [
    { fromName: "Grupo1", emoji: "alvo" },
    { fromName: "Grupo2", emoji: "alvo" },
    { fromName: "Grupo3", emoji: "mala" },
    { fromName: "Grupo4", emoji: "vomito" },
    { fromName: "UnicoAliado", emoji: "coracao" }
  ]
};

const risco = fatorRisco({ received: emRisco.received });
// Resultado: 2 + 1 + 1 = 4 (baixo risco, mas atenção)

const pop = indicePopularidade({ received: emRisco.received });
// Resultado: 1 - 4 = -3 (impopular)
```

## 🔍 Queries Úteis para Análise

### 1. Quem são os alvos de jogo (quem RECEBEU 🎯)?
```javascript
function alvosMaisCitados(dados) {
  const alvos = {};

  dados.forEach(participante => {
    participante.received.forEach(reacao => {
      if (reacao.emoji === 'alvo') {
        alvos[reacao.fromName] = (alvos[reacao.fromName] || 0) + 1;
      }
    });
  });

  return Object.entries(alvos)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
}
```

### 2. Quais alianças são recíprocas?
```javascript
function aliancasReciprocas(dados) {
  const reciprocas = [];

  dados.forEach(p1 => {
    dados.forEach(p2 => {
      if (p1 === p2) return;

      const p1DeuCoracao = p1.received.some(r =>
        r.emoji === 'coracao' && r.fromName === nomeDe(p2)
      );
      const p2DeuCoracao = p2.received.some(r =>
        r.emoji === 'coracao' && r.fromName === nomeDe(p1)
      );

      if (p1DeuCoracao && p2DeuCoracao) {
        reciprocas.push([nomeDe(p1), nomeDe(p2)]);
      }
    });
  });

  return [...new Set(reciprocas.map(pair => pair.sort().join(' ↔ ')))];
}
```

### 3. Evolução temporal de um participante
```javascript
function evolucaoParticipante(nome, dadosDiarios) {
  return dadosDiarios.map(dia => {
    const participante = dia.find(p => p.pageUrl.includes(nome));
    if (!participante) return null;

    return {
      date: dia.date,
      popularidade: indicePopularidade(participante),
      risco: fatorRisco(participante),
      totalReacoes: participante.received.length
    };
  }).filter(Boolean);
}
```

## 📊 Dashboards Recomendados

### 1. Ranking de Popularidade Geral
```
Participante | Popularidade | Risco | Total Reações
Solange     | +12          | 2    | 21
Breno       | +8           | 4    | 21
Marcelo     | +5           | 3    | 21
```

### 2. Mapa de Alianças
```
           | Solange | Breno | Marcelo | Maxiane
Solange   |   -     |   ❤️   |   ❤️    |   💔
Breno     |   ❤️    |   -    |   🐍    |   🌱
Marcelo   |   ❤️    |   💔   |   -     |   ❤️
Maxiane   |   💔    |   🌱   |   ❤️    |   -
```

### 3. Alertas de Risco
```
🚨 ALTO RISCO (>10):
- ParticipanteX: 15 pontos de risco
- ParticipanteY: 12 pontos de risco

⚠️ MÉDIO RISCO (5-10):
- ParticipanteZ: 8 pontos de risco
```

## 🎯 Insights Estratégicos

### Padrões Comuns Identificados:

1. **"Ilha":** Participante com muitos ❤️ mas poucos de volta = está sendo usado
2. **"Ditador":** Manda muitos 🎯 + 💼 para outros = controlador tóxico
3. **"Camaleão":** Muda alianças frequentemente = jogador estratégico
4. **"Fantasma":** Recebe muitos 🌱 = não tem opinião formada
5. **"Bode":** Recebe muitos 🎯 + poucos ❤️ = provável eliminado

### Estratégias de Sobrevivência:

- **Mantenha alianças recíprocas** (❤️ mútuos)
- **Evite acumular muitos 🎯** (você é considerado alvo quando RECEBE este emoji)
- **Monitore quem manda 🐍** (possíveis traidores)
- **Use 🍪 com moderação** (visibilidade sem incomodar)
- **Esteja atento aos 💔** (decepções podem virar traições)

---

**💡 Os dados do queridômetro são uma ferramenta poderosa para entender a dinâmica social do BBB, revelando alianças, conflitos e estratégias que os participantes tentam esconder!**
