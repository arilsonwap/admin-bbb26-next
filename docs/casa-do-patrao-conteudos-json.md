# Consumo do JSON unificado — Casa do Patrão (Mobile)

## 1. Origem do JSON

- **Arquivo publicado (repositório/build)**: `tools/bbb-hosting/public/casa-do-patrao-conteudos.json`
- **URL pública esperada (Firebase Hosting)**: `https://bbb-26.web.app/casa-do-patrao-conteudos.json`
- **Preview no admin (via whitelist)**: `/api/hosting-public/casa-do-patrao-conteudos.json`

## 2. Schema principal

```ts
type CasaDoPatraoConteudo = {
  title: string;
  href: string;
  imageUrl?: string | null;
  type: 'noticia' | 'video' | 'foto';
  category?: string | null;
  time?: string | null;
};

type CasaDoPatraoConteudosPayload = {
  source: 'casa-do-patrao-conteudos';
  fetchedAt: string | null;
  lastAddedCount: number;
  counts: {
    noticia: number;
    video: number;
    foto: number;
  };
  items: CasaDoPatraoConteudo[];
};
```

## 3. Regras para o app

- O app deve consumir **`casa-do-patrao-conteudos.json`**.
- `items[]` é uma **lista única** de conteúdos (notícias, vídeos e fotos).
- O app deve montar as abas usando `items[].type`:
  - `noticia` → aba **Notícias**
  - `video` → aba **Vídeos**
  - `foto` → aba **Fotos**
- `title` é o texto principal do card.
- `href` é o link absoluto para abrir em navegador/webview e também serve como **chave única** (id).
- `imageUrl` é opcional; se vier vazio (`null`/`undefined`), o app deve mostrar **placeholder**.
- `category` e `time` são opcionais; podem ser usados como subtítulo/badge.
- `fetchedAt` pode ser usado para exibir “Atualizado em...”.
- `counts` pode ser usado para badge/contador nas abas (sem precisar contar no client).
- `lastAddedCount` é mais útil para admin, mas pode ser exibido se fizer sentido.

## 4. Regras de renderização

- Respeitar a ordem de `items[]` (itens mais novos tendem a vir primeiro).
- Não precisa deduplicar no app, porque o JSON já vem deduplicado por `href`.
- Se quiser segurança extra, deduplicar por `href` no app.
- Filtrar abas assim:

```ts
const noticias = items.filter(i => i.type === 'noticia');
const videos = items.filter(i => i.type === 'video');
const fotos = items.filter(i => i.type === 'foto');
```

## 5. Cuidados

- O app não deve depender de `category/time` existirem.
- O app não deve quebrar se `imageUrl` vier `null/undefined`.
- O app não deve assumir que sempre haverá itens dos 3 tipos.
- O app deve tratar erro de rede e JSON vazio.

