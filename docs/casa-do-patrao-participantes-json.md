# Consumo do JSON — 🏠 Casa do Patrão (Participantes) (Mobile)

## 1. Origem do JSON

- **Arquivo publicado (repositório/build)**: `tools/bbb-hosting/public/casa-do-patrao-participantes.json`
- **URL pública esperada (Firebase Hosting)**: `https://bbb-26.web.app/casa-do-patrao-participantes.json`
- **Preview no admin (via whitelist)**: `/api/hosting-public/casa-do-patrao-participantes.json`

## 2. Schema principal

Observação: este JSON é uma **lista** (array) de participantes.

```ts
type CasaDoPatraoParticipante = {
  nome: string;
  funcao: string;
  funcaoSlug: string | null;
};

type CasaDoPatraoParticipantesPayload = CasaDoPatraoParticipante[];
```

## 3. Regras para o app

- O app deve consumir **`casa-do-patrao-participantes.json`**.
- O payload é uma lista única de participantes/funcões no formato acima.
- `nome` é o texto principal do item.
- `funcao` vem em **maiúsculo** (ex.: `PATRÃO`, `PARÇA`, `COZINHA`).
- `funcaoSlug` é o valor normalizado para uso em filtros/ícones/estilo (pode ser `null`).
- Recomendação de chave (key): **`nome + '::' + funcao`**.

## 4. Regras de renderização

- Respeitar a ordem do array como padrão (pode ser ordenado no app se necessário).
- Não assumir que sempre existirão as mesmas funções (roles) em todas as execuções.

## 5. Cuidados

- O app não deve quebrar se `funcaoSlug` vier `null`.
- Tratar erro de rede e payload vazio (`[]`).

## 6. Extração manual no navegador (DevTools)

Quando a página usar a **barra de participantes** (carrossel) em vez dos cards `.participant-card` que o script Node usa, cada item costuma estar em:

- **Container da lista**: `.participant-bar__list`
- **Item**: `.swiper-slide.participant-bar__item` (ou `.participant-bar__list .participant-bar__item`)
- **Nome**: atributo `title="..."` (fallback: `alt` da `img` ou `textContent`)

O badge **“Patrão”** (ou outro papel) pode estar **fora** do mesmo `div.participant-bar__item` (sobreposição abaixo do avatar). Nesse caso o primeiro script pode devolver `status: null` para quase todos — use o segundo (geometria + palavras-chave).

### 6.1 — Leitura básica (nome + tentativa de badge interno)

```js
(() => {
  const items = Array.from(
    document.querySelectorAll(".participant-bar__list .participant-bar__item")
  );

  const participantes = items.map((item) => {
    const nome =
      item.getAttribute("title")?.trim() ||
      item.querySelector("img")?.getAttribute("alt")?.trim() ||
      item.textContent.trim();

    const textoInterno = item.innerText
      .replace(/\s+/g, " ")
      .trim();

    const isAtivo = item.classList.contains("swiper-slide-active");

    let status = null;

    const possiveisBadges = Array.from(
      item.querySelectorAll(
        "[class*='status'], [class*='badge'], [class*='role'], [class*='funcao'], span, small, strong"
      )
    )
      .map((el) => el.innerText?.trim())
      .filter(Boolean);

    if (possiveisBadges.length > 0) {
      status = possiveisBadges.join(" | ");
    }

    if (!status && textoInterno && textoInterno !== nome) {
      status = textoInterno;
    }

    return {
      nome,
      status,
      ativo: isAtivo,
    };
  });

  console.table(participantes);
  copy(JSON.stringify(participantes, null, 2));

  return participantes;
})();
```

### 6.2 — Fallback agressivo (texto próximo ao slide, palavras-chave)

```js
(() => {
  const slides = Array.from(
    document.querySelectorAll(".participant-bar__list .participant-bar__item")
  );

  const participantes = slides.map((slide) => {
    const nome = slide.getAttribute("title")?.trim() || null;

    const rect = slide.getBoundingClientRect();

    const elementosProximos = Array.from(document.querySelectorAll("body *"))
      .filter((el) => {
        const text = el.innerText?.trim();
        if (!text) return false;

        const r = el.getBoundingClientRect();

        const pertoHorizontal =
          r.left < rect.right + 20 && r.right > rect.left - 20;

        const pertoVertical =
          r.top >= rect.top && r.top <= rect.bottom + 40;

        return pertoHorizontal && pertoVertical;
      })
      .map((el) => el.innerText.trim())
      .filter((text) => {
        if (!text) return false;
        if (text === nome) return false;
        if (text.length > 40) return false;

        return /patrão|patrao|capataz|peão|peao|cozinha|celeiro|vip|líder|lider/i.test(
          text
        );
      });

    return {
      nome,
      status: elementosProximos[0] || null,
      textosDetectados: elementosProximos,
    };
  });

  console.table(participantes);
  copy(JSON.stringify(participantes, null, 2));

  return participantes;
})();
```

### 6.3 — JSON alinhado ao schema deste doc (`nome`, `funcao`, `funcaoSlug`)

Conforme a **seção 3**, `funcao` deve ir em **maiúsculas** (ex.: `PATRÃO`). O snippet abaixo normaliza slug como no app (`patrao`, `parca`, etc., derivados do texto em maiúsculas).

```js
(() => {
  const items = Array.from(
    document.querySelectorAll(".participant-bar__list .participant-bar__item")
  );

  const normalizeSlug = (value) =>
    value
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const funcaoToSlug = (funcaoUpper) => {
    const f = (funcaoUpper || "").trim();
    if (!f) return null;
    if (f === "PATRÃO") return "patrao";
    if (f === "PARÇA") return "parca";
    return normalizeSlug(f) || null;
  };

  const participantes = items.map((item) => {
    const nome = item.getAttribute("title")?.trim();
    const texto = item.innerText?.replace(/\s+/g, " ").trim();

    let funcaoLabel = null;
    if (/patrão|patrao/i.test(texto)) funcaoLabel = "Patrão";
    else if (/capataz/i.test(texto)) funcaoLabel = "Capataz";
    else if (/peão|peao/i.test(texto)) funcaoLabel = "Peão";
    else if (/cozinha/i.test(texto)) funcaoLabel = "Cozinha";
    else if (/parça|parca/i.test(texto)) funcaoLabel = "Parça";

    const funcao = funcaoLabel
      ? funcaoLabel.toLocaleUpperCase("pt-BR")
      : "";

    return {
      nome,
      funcao,
      funcaoSlug: funcaoToSlug(funcao),
    };
  });

  console.log(JSON.stringify(participantes, null, 2));
  copy(JSON.stringify(participantes, null, 2));

  return participantes;
})();
```

**Limite**: só pela barra do topo você obtém o que está **visível** naquele momento; papéis em outro estado da UI, JSON embutido ou API podem faltar. Próximo passo útil: **Network → Fetch/XHR** e respostas com `participants`, `elenco`, `player`, `ranking`, `status`, `casa-do-patrao`, etc.

