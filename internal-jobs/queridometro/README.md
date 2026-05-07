# BBB Queridômetro Scraper

Script Node.js que utiliza Playwright para extrair dados do queridômetro dos participantes do BBB 26.

## Funcionalidades

- Extrai contadores de emojis (❤️, 💔, 🐍, etc.)
- Extrai lista de "recebidos" (quem enviou cada emoji)
- **Agrupamento automático por emoji**: `porEmoji.coracao = [nomes...]`
- **Visibilidade completa**: Todos os 9 tipos de emoji
- **Retry inteligente**: Até 3 tentativas para erros temporários, para imediato em erros permanentes
- **Isolamento de páginas**: Cada participante roda em página própria (não contamina outros)
- **Tratamento robusto de overlays**: Fecha cookies/consent automaticamente e com segurança
- **Normalização inteligente**: Padroniza emojis com tratamento correto de acentos (NFD)
- **Parsing robusto de contadores**: Lida com formatos como "1.234" ou "1.234+" usando regex
- **Timeouts adaptativos**: 15s na 1ª tentativa, 25s na 2ª tentativa para o queridômetro carregar
- **Delay extra na retry**: +3s na 2ª tentativa para conteúdo JS carregar completamente
- **Detecção HTTP inteligente**: 429=rate_limit, 5xx=server_error, 4xx=client_error
- **Classificação de erros precisa**: not_found, dom, blocked (elimina "other")
- **Evidências completas**: HTTP status, URL final, presença de section, contadores, título
- **Estratégia de carregamento progressiva**: domcontentloaded → load → networkidle
- **Validação de conteúdo**: Rejeita dados vazios/incompletos automaticamente
- **Pausas inteligentes**: 1s entre tentativas para não sobrecarregar o servidor
- **Espera inteligente por conteúdo**: Verifica se dados reais carregaram antes de prosseguir
- **Versão simplificada (bbb-queridometro.js)**: Para testes rápidos com validação robusta
- **Bloqueio de recursos pesados**: Sem imagens/fonts/vídeos = mais velocidade e estabilidade
- **Scroll inteligente**: Garante visibilidade do queridômetro antes da extração
- **Indexação otimizada**: Campo `participantSlug` para indexação rápida no app
- **Dados enriquecidos**: `porEmojiDetailed` com URLs completas dos participantes
- Salva dados em JSON datado
- **Ignorar participantes eliminados**: Via comentário no código ou variável de ambiente
- Executa automaticamente via cron diariamente
- **Participantes monitorados**: Solange Couto, Breno, Marcelo, Maxiane, Samira, Leandro, Alberto Cowboy, Ana Paula Renault, Babu Santana, Chaiany, Gabriela, Jonas Sulzbach, Jordana, Juliano Floss, Marciele, Milena

## 🎯 Significado dos Emojis do Queridômetro BBB

### Tabela Completa dos Emojis

| Emoji | Nome | Significado no BBB | Interpretação Estratégica |
|-------|------|-------------------|--------------------------|
| ❤️ | **Coração** | Afinidade, amor, aliado próximo | **Alianças fortes** - confiança mútua, amizade verdadeira |
| 💔 | **Coração Partido** | Desapontamento, mágoa ou ruptura de aliança | **Quebra de confiança** - traição, decepção ou mudança de lado |
| 🐍 | **Cobra** | Falsidade, traição ou pessoa em quem não se confia | **Alerta vermelho** - possível backstabber ou fingimento |
| 🌱 | **Planta** | Participante passivo, que não se posiciona ou não gera conteúdo | **Neutro/Silencioso** - não interfere, não ajuda, "planta" |
| 🍪 | **Biscoito** | Pessoa que busca chamar a atenção ("vtzeiro"), quer biscoitar | **Busca visibilidade** - quer aparecer, faz drama desnecessário |
| 🎯 | **Alvo** | O participante que RECEBEU é considerado alvo de jogo | **Em risco** - provável candidato à eliminação |
| 💼 | **Mala** | Difícil de conviver, chato ou inconveniente | **Inconveniente** - personalidade difícil, reclamação constante |
| 🤮 | **Vômito** | Nojo, desprezo absoluto pela atitude do outro | **Rejeição total** - incompatibilidade extrema, nojo genuíno |
| 🤥 | **Nariz de Pinóquio** | Mentiroso | **Desconfiança** - pessoa mentirosa ou que não fala a verdade |

### Interpretação Estratégica dos Dados

#### 📈 **Padrões de Participante Popular:**
- **Muitos ❤️** (alianças sólidas)
- **Poucos 🐍/🤥** (alta confiança)
- **Alguns 🍪** (busca visibilidade saudável)
- **Raros 🎯/💼** (não é prioridade para eliminação)

#### 🚨 **Padrões de Participante Ameaçado:**
- **Muitos 🎯 + 💼** (alvo do paredão + inconveniente)
- **Vários 🐍 + 🤥** (desconfiança generalizada)
- **Poucos ❤️** (poucas alianças de proteção)
- **Possíveis 💔** (decepções com antigos aliados)

#### 🎭 **Padrões de Participante Estratégico:**
- **❤️ equilibrados** (alianças calculadas)
- **Alguns 🍪** (visibilidade controlada)
- **Raros 🐍/🤥** (mantém confiança)
- **🌱 moderados** (não se expõe demais)

### Exemplos Práticos de Análise

**Cenário: Participante recebe 15 ❤️, 8 🐍, 3 🍪**
- **Análise**: Aliado popular mas com desconfianças - possível pivô estratégico
- **Risco**: Pode estar sendo usado como bode expiatório por traidores

**Cenário: Participante recebe 20 🎯, 12 💼, 5 🤮**
- **Análise**: Em grave risco de eliminação - rejeitado pela casa
- **Chance**: Pouca, a menos que forme aliança forte de última hora

**Cenário: Participante recebe 18 🌱, 2 ❤️, 1 🍪**
- **Análise**: Sobrevivente passivo - não gera conflitos nem alianças
- **Chance**: Média, depende de como os ativos se eliminam entre si

## Instalação

```bash
npm init -y
npm i playwright
npx playwright install chromium
```

## Ignorando Participantes Eliminados

### Método 1: Comentário no código
Edite `queridometro.js` e comente a linha do participante eliminado:

```javascript
// "https://gshow.globo.com/realities/bbb/bbb-26/participantes/matheus/", // ELIMINADO
```

### Método 2: Variável de ambiente
Defina a variável `IGNORED_PARTICIPANTS` com lista separada por vírgulas:

```bash
IGNORED_PARTICIPANTS=matheus,solange ./run-queridometro.sh
```

## Como usar

### Execução manual

#### Para múltiplos participantes:
```bash
node queridometro.js
```
Mostra no console: **TODOS os emojis** que cada participante recebeu, com quantidades e nomes:
- ❤️ Coração, 💔 Coração Partido, 🧳 Mala, 🌱 Planta, 🤮 Vômito, 🎯 Alvo, 🍪 Biscoito, 🐍 Cobra, 🤥 Mentiroso

#### Para um participante específico (exemplo):
```bash
node exemplo-solange.js
```
Mostra no console: listas completas de quem deu cada emoji (todos os 9 tipos).

### Execução automática (cron)
O script está configurado para executar diariamente às 8:00 da manhã via cron.

Para modificar a frequência:
```bash
crontab -e
```

## Configuração

### Adicionar participantes

Edite o array `urls` no arquivo `queridometro.js`:

```javascript
const urls = [
  "https://gshow.globo.com/realities/bbb/bbb-26/participantes/solange-couto/",
  "https://gshow.globo.com/realities/bbb/bbb-26/participantes/breno/",
  // adicione mais...
];
```

## Estrutura dos dados

Os dados são salvos em `data/queridometro-YYYY-MM-DD.json`:

```json
[
  {
    "date": "2026-01-23",
    "pageUrl": "https://...",
    "tab": "Recebidos",
    "counters": [
      {
        "emoji": "coracao",
        "count": 17
      }
    ],
    "received": [
      {
        "fromName": "Breno",
        "emoji": "coracao",
        "profileUrl": "https://..."
      }
    ],
    "porEmoji": {
      "coracao": ["Breno", "Marcelo", "Maxiane"],
      "planta": ["Samira", "Ana Paula Renault"],
      "coracao_partido": ["Sol Vega"],
      "mala": ["Milena"]
    }
  }
]
```

## 📚 Documentação

- **[EMOJIS.md](EMOJIS.md)**: Guia completo dos 9 emojis do queridômetro
- **[ANALISE-QUERIDOMETRO.md](ANALISE-QUERIDOMETRO.md)**: Tutoriais e exemplos de análise dos dados
- **[QUERIES-EXEMPLO.js](QUERIES-EXEMPLO.js)**: Scripts prontos para análise (ranking, risco, alianças)

## Logs

Verifique `queridometro.log` para acompanhar as execuções automáticas.
