# Resumo do Jogo - BBB Scraper

Scraper para extrair dados dos participantes do BBB 26 do site GShow usando Playwright.

## Instalação

```bash
npm install
npx playwright install chromium
```

## Como usar

### 🚀 **MELHOR FORMA: Buscar todos os participantes automaticamente**

```bash
# Usando npm script (recomendado)
npm run scrape-all

# Ou diretamente o script bash
./scrape-all.sh
```

### Scraping individual ou personalizado

#### Um participante específico:
```bash
npm run scrape "https://gshow.globo.com/realities/bbb/bbb-26/participantes/alberto-cowboy/"
```

#### Múltiplos participantes selecionados:
```bash
npm run scrape \
  "https://gshow.globo.com/realities/bbb/bbb-26/participantes/alberto-cowboy/" \
  "https://gshow.globo.com/realities/bbb/bbb-26/participantes/babu-santana/"
```

#### Com nome de arquivo personalizado:
```bash
npm run scrape "url" --output meu-arquivo.json
```

### 📋 **Resumo das opções:**

| Comando | Descrição | Arquivo de saída |
|---------|-----------|------------------|
| `npm run scrape-all` | **RECOMENDADO** - Todos os 24 participantes | `statusbbb.json` |
| `npm run scrape "url"` | Participante específico | `statusbbb.json` |
| `./scrape-all.sh` | Script bash direto | `statusbbb.json` |
| `npm run scrape "url1" "url2"` | Múltiplos selecionados | `statusbbb.json` |

## Dados extraídos

O scraper retorna um JSON com:

- `id`: ID do participante (extraído da URL)
- `url`: URL do participante
- `status`: Status atual (vip, líder, etc.)
- `estalecas`: Número deestalecas
- `historico`: Objeto com contadores históricos:
  - `lider`: Vezes que foi líder
  - `paredao`: Vezes que foi ao paredão
  - `imune`: Vezes que foi imune
  - `anjo`: Vezes que foi anjo
  - `naMira`: Vezes que esteve na mira
  - `monstro`: Vezes que foi monstro
  - `vip`: Vezes que foi VIP
  - `xepa`: Vezes que foi xepa

## Exemplo de saída

### Estrutura atual (sempre com data):
```json
{
  "dataBusca": "2026-01-27",
  "participantes": {
    "id": "alberto-cowboy",
    "url": "https://gshow.globo.com/realities/bbb/bbb-26/participantes/alberto-cowboy/",
    "status": "vip",
    "estalecas": 850,
    "historico": {
      "lider": 1,
      "paredao": 0,
      "imune": 0,
      "anjo": 0,
      "naMira": 0,
      "monstro": 0,
      "vip": 3,
      "xepa": 0
    }
  }
}
```

### Múltiplos participantes:
```json
{
  "dataBusca": "2026-01-27",
  "participantes": [
    {
      "id": "babu-santana",
      "url": "https://gshow.globo.com/realities/bbb/bbb-26/participantes/babu-santana/",
      "status": "líder",
      "estalecas": 800,
      "historico": { "lider": 1, "paredao": 0, "vip": 3, ... }
    },
    {
      "id": "aline-campos",
      "url": "https://gshow.globo.com/realities/bbb/bbb-26/participantes/aline-campos/",
      "status": "eliminada",
      "estalecas": null,
      "historico": { "paredao": 1, "vip": 1, "xepa": 1, ... }
    }
  ]
}
```

## Estrutura do projeto

```
services/
  gshowScraper.ts    # Módulo principal do scraper
utils/               # Utilitários (futuros)
scrape-gshow-bbb26.ts # CLI para execução
```