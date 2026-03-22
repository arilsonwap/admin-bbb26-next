# Ícones de Status do BBB

Esta pasta contém os ícones SVG usados para representar diferentes status e elementos do BBB 26.

## Arquivos:

- `anjo.svg` - 👼 Ícone de anjo
- `estalecas.svg` - ⭐ Ícone de estalecas/pontos
- `grupo.svg` - 👥 Ícone de grupo/ranking
- `imune.svg` - 🛡️ Ícone de imunidade
- `lider.svg` - ⭐ Ícone de líder
- `monstro.svg` - 👹 Ícone de monstro
- `paredao.svg` - ⚖️ Ícone de paredão

## Especificações:

- **Formato:** SVG otimizado
- **Cores:** Definidas via `fill="currentColor"` para suporte dinâmico
- **Uso:** Componentes React importados automaticamente pelo Metro bundler

## Como usar:

Os ícones são automaticamente importados e registrados no sistema `UIIcon`:

```tsx
// Uso direto
<UIIcon name="estalecas" size={20} color="#FFD700" />

// No código, são mapeados automaticamente
const UI_SVG = {
  anjo: AnjoIcon,
  estalecas: EstalecasIcon,
  grupo: GrupoIcon,
  imune: ImuneIcon,
  lider: LiderIcon,
  monstro: MonstroIcon,
  paredao: ParedaoIcon,
  // xepa: XepaIcon, // Arquivo não encontrado
};

const UI_PNG = {
  // Todos os ícones foram migrados para SVG
};
```

## Status suportados:

- `vip` - 👑
- `lider` - ⭐ (SVG customizado)
- `imune` - 🛡️ (SVG customizado)
- `anjo` - 👼 (SVG customizado)
- `monstro` - 👹 (SVG customizado)
- `paredao` - ⚖️ (SVG customizado)
- `estalecas` - ⭐ (SVG customizado)
- `grupo` - 👥 (SVG customizado)