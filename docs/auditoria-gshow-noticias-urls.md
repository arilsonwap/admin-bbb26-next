# Auditoria: fluxo de URLs das notícias Gshow (extrator → JSON → app)

**Projeto:** admin-bbb26-next  
**Escopo:** origem dos links, transformações, riscos de 404, merge com JSON antigo e patch aplicado.

---

## 1. Fluxo de extração

| Etapa | Descrição |
|--------|-----------|
| **Fonte** | `GET` em HTML da página hub `SOURCE_URL`: `https://gshow.globo.com/realities/bbb/bbb-26/`, com `cache: 'no-store'`. |
| **Parsing** | Não há Cheerio, API oficial, RSS ou feed JSON. O código usa **regex** sobre o HTML, numa fatia ao redor do texto **"últimas notícias"** (ou o HTML inteiro se o marcador não existir). |
| **Link** | Apenas o atributo **`href`** dos elementos `<a>` é utilizado. Não há leitura de `<link rel="canonical">`, JSON-LD, GraphQL, `shareUrl`, etc. |
| **Persistência** | Lê `tools/bbb-hosting/public/noticiasbbb.json`, **mescla** notícias novas (extração atual) com notícias antigas (arquivo), limita a **50** itens, grava novamente e atualiza `noticiasbbb-latest.json`. |
| **Consumo** | A rota `GET /api/gshow-bbb26-news` (e `?read=1`) devolve o array `items`. A UI admin (`GshowNewsScreen`) usa `it.href` como URL. |

**Arquivos centrais**

- `src/app/api/gshow-bbb26-news/route.ts` — extrator e merge  
- `tools/bbb-hosting/public/noticiasbbb.json` — payload consumido pelo app  
- `tools/bbb-hosting/public/noticiasbbb-latest.json` — apenas metadados do arquivo principal  
- `.github/workflows/update-gshow-news.yml` — atualização periódica (cron a cada 10 minutos)

---

## 2. Onde a URL nasce

- **Origem única:** valor bruto do atributo `href` do `<a>`, processado por `normalizeHref`.

**Campo exportado no JSON:** `href` (não existem campos `url`, `canonicalUrl`, `permalink`, `articleUrl` neste payload).

Cada item segue o formato:

```json
{ "title": "...", "href": "https://...", "imageUrl": "..." }
```

**Fonte mais confiável em teoria:** URL canônica da **página da matéria** (`<link rel="canonical">` ou URL final após redirects). Este projeto **não** extrai isso; repete o `href` apresentado no hub. Em teste pontual (HTTP), o `href` salvo coincidiu com o `canonical` da matéria.

---

## 3. Transformações aplicadas

| Transformação | Detalhe |
|----------------|---------|
| `trim` | Espaços removidos do `href` bruto (após ajuste no código). |
| Protocol-relative | `//host/...` → `https://host/...` |
| Path relativo | `/...` → `https://gshow.globo.com/...` |
| Absoluto `http(s)` | Mantido como está |
| Query / hash | Não há `encodeURIComponent`/`decodeURIComponent` genérico; links com `#` são **ignorados** na extração |
| Filtros | Path deve incluir `/realities/bbb/bbb-26/`; URLs de vídeo são excluídas por regex |

---

## 4. Riscos encontrados

| Risco | Impacto |
|--------|---------|
| **Merge com histórico** | Novas entradas vêm primeiro; em seguida entram itens **antigos do JSON** cujo `href` não apareceu na extração atual. Matérias **removidas ou despublicadas** no Gshow podem permanecer na lista até serem empurradas pelo limite de 50 → **404 no app**. |
| **`noticiasbbb-latest.json`** | Contém apenas `file`, `lastModified`, `localDate`, `bytes`. **Não** duplica a lista de notícias. Não é causa de “dois JSONs com links diferentes” para o mesmo conteúdo. |
| **Sem validação pós-extração** | Não há `HEAD`/`GET` na matéria para remover URLs mortas. |
| **Heurística HTML** | Depende do bloco “últimas notícias” e de regex; mudanças de markup no site podem afetar a captura. |
| **Deduplicação** | Chave `href::title`; cenários raros de duplicação se o mesmo `href` aparecer com títulos diferentes. |

---

## 5. Causa raiz mais provável (404)

1. **Extração:** o `href` copiado do hub tende a ser o mesmo caminho usado pelo site (validação pontual: HTTP 200 e `canonical` alinhado ao `href`).
2. **404 intermitente:** é **plausível** que seja **persistência de links no JSON após a matéria sair do ar**, pelo **merge com itens antigos**, mais do que “URL gerada errada” só pelo extrator.

---

## 6. Evidências (exemplos reais)

No fluxo atual, **URL bruta após `normalizeHref` = URL final exportada** (não há segundo passo de reescrita).

| Título | URL (bruta = final) | Observação |
|--------|---------------------|------------|
| Durante ação, Chaiany dá ‘selinho’ em Marciele no BBB 26 | `https://gshow.globo.com/realities/bbb/bbb-26/dentro-da-casa/noticia/durante-acao-chaiany-da-selinho-em-marciele-no-bbb-26.ghtml` | Amostra testada: HTTP 200; canonical igual ao href. |
| Ana Paula Renault provoca Jonas Sulzbach... | `https://gshow.globo.com/realities/bbb/bbb-26/dentro-da-casa/noticia/ana-paula-renault-provoca-jonas-sulzbach-hoje-vale-tirar-a-sunga-branca-da-mala.ghtml` | Padrão típico `dentro-da-casa/noticia/....ghtml` |
| Vídeos do Raio-X de segunda, 23/3... | `https://gshow.globo.com/realities/bbb/bbb-26/videos-do-bbb/raio-x/playlist/videos-do-raio-x-de-segunda-233-do-bbb-26.ghtml` | Playlist (formato diferente de matéria texto) |
| Resumo BBB 26: veja os vídeos do dia... | `https://gshow.globo.com/realities/bbb/bbb-26/videos-do-bbb/playlist/resumo-bbb-26-veja-os-videos-do-dia-2332026-click-bbb.ghtml` | Idem |
| Solange Couto reclama de sisters... | `https://gshow.globo.com/realities/bbb/bbb-26/dentro-da-casa/noticia/solange-couto-reclama-de-sisters-no-bbb-26-parece-que-sou-transparente.ghtml` | Padrão notícia |

*(Valores conforme `tools/bbb-hosting/public/noticiasbbb.json` na data da auditoria.)*

---

## 7. Diferença: `noticiasbbb.json` vs `noticiasbbb-latest.json`

| Arquivo | Conteúdo |
|---------|----------|
| `noticiasbbb.json` | `source`, `fetchedAt`, `lastAddedCount`, `items[]` com `title`, `href`, `imageUrl` — **fonte de verdade para o app**. |
| `noticiasbbb-latest.json` | Apenas metadados (`file`, `lastModified`, `localDate`, `bytes`) sobre a última gravação do principal. |

Não há risco de “link velho” por existirem dois JSONs com listas diferentes; o segundo **não** contém URLs de notícias.

---

## 8. Patch aplicado no extrator

Arquivo: `src/app/api/gshow-bbb26-news/route.ts`

1. **`normalizeHref`:** uso de `trim` no `href` para evitar espaços.  
2. **Regex de `<a>`:** aceita `href="..."` e `href='...'`.  
3. **Comentário** no bloco de merge documentando o risco de manter URLs antigas que podem retornar 404.

**Melhorias opcionais (não obrigatórias neste documento):**

- Parâmetro de API que grave **somente** o resultado da extração (sem merge), para ambientes que não precisam de histórico.  
- Job opcional que faça verificação HTTP (`HEAD` ou `GET` leve) em URLs antigas e remova entradas com 404.  
- Enriquecimento opcional: buscar `<link rel="canonical">` na URL da matéria (custo: N requisições por execução).

---

## 9. Resumo executivo

| Pergunta | Resposta |
|----------|----------|
| Onde busca dados? | HTML da página hub; não é API/feed RSS formal. |
| De onde vem o link? | Só `href` dos `<a>` na fatia HTML. |
| Campo no JSON | `href` |
| Principal risco de 404 neste repo? | Merge que preserva links antigos após remoção no site. |
| `noticiasbbb-latest.json` afeta URL? | Não; é só metadados. |

---

*Documento gerado com base na leitura do código em `src/app/api/gshow-bbb26-news/route.ts` e nos artefatos em `tools/bbb-hosting/public/`.*
