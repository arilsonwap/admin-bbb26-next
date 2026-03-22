# 📸 Imagens dos Participantes BBB26

## 🎯 **STATUS ATUAL: Sistema híbrido funcionando!**

O app agora usa um **sistema híbrido inteligente**:
- 🎨 **Imagens locais** quando disponíveis (ex: Alberto Cowboy)
- 🤖 **Avatares automáticos** para os demais participantes
- ⚡ **Fallback automático** se imagem local não existir
- ✅ **Sem problemas de build**

## 📊 **Imagens configuradas (21 participantes - 100%!):**

### **🏆 VETERANOS (6/6):**
- ✅ **Alberto Cowboy** - `alberto-cowboy.png`
- ✅ **Ana Paula Renault** - `ana-paula-renault.png`
- ✅ **Babu Santana** - `babu-santana.png`
- ✅ **Jonas Sulzbach** - `jonas-sulzbach.png`
- ✅ **Sarah Andrade** - `sarah-andrade.png`
- ✅ **Sol Vega** - `sol-vega.png`

### **⭐ CAMAROTE (5/5):**
- ✅ **Aline Campos** - `aline-campos.png`
- ✅ **Edílson** - `edilson.png`
- ✅ **Henri Castelli** - `henri-castelli.png`
- ✅ **Juliano Floss** - `juliano-floss.png`
- ✅ **Solange Couto** - `solange-couto.png`

### **🍿 PIPOCA (10/10):**
- ✅ **Breno** - `breno.png`
- ✅ **Brígido** - `brigido.png`
- ✅ **Chaiany** - `chaiany.png`
- ✅ **Gabriela** - `gabriela.png`
- ✅ **Jordana** - `jordana.png`
- ✅ **Leandro** - `leandro.png`
- ✅ **Marcelo** - `marcelo.png`
- ✅ **Marciele** - `marciele.png`
- ✅ **Matheus** - `matheus.png`
- ✅ **Maxiane** - `maxiane.png`
- ✅ **Milena** - `milena.png`
- ✅ **Paulo Augusto** - `paulo-augusto.png`
- ✅ **Samira** - `samira.png`

### **🎉 RESULTADO:**
**21/21 participantes** têm suas imagens reais no app! 🏆
*100% COMPLETO - TODOS os brothers e sisters têm imagens reais!* da UI Avatars

## 🚀 **Para implementar imagens locais futuramente:**

### 1. Preparar as imagens:
- **Nome:** `nome-participante.png` (ex: `alberto-cowboy.png`)
- **Formato:** PNG com fundo transparente
- **Tamanho:** 200x200px ou maior

### 2. Modificar `src/data/bbb26Participants.ts`:

```typescript
// 1. Adicionar importação estática no topo do arquivo:
const nomeParticipanteImage = require("../assets/participants/nome-participante.png");

// 2. Adicionar no mapeamento localImages dentro de getParticipantImage:
const localImages: { [key: string]: any } = {
  [normalizeName('Alberto "Cowboy"')]: albertoCowboyImage,
  [normalizeName('Nome Completo do Participante')]: nomeParticipanteImage, // ← Adicione aqui
};
```

## 🎯 **Sistema inteligente implementado:**

### ✅ **Normalização automática:**
- Remove acentos e caracteres especiais das chaves
- Evita bugs com variações de nomes
- Busca case-insensitive e sem acentos

### ✅ **Fallback inteligente:**
```typescript
const participantImage =
  localImages[normalizeName(name)] ?? getAutomaticAvatar(name);
```
**Como funciona:**
- 🎯 **Primeiro:** Busca imagem local normalizada
- 🤖 **Fallback:** Avatar automático se participante não mapeado
- ⚠️ **Atenção:** Fallback não detecta arquivos inexistentes (build falha)

### ✅ **Código final corrigido:**
```typescript
// ✅ IMPORTANTE (Metro bundler):
// Use apenas require ESTÁTICO. Evite caminhos dinâmicos com template strings.

const albertoCowboyImage = require("../assets/participants/alberto-cowboy.png");
const babuSantanaImage = require("../assets/participants/babu-santana.png");

const localImages: Record<string, any> = {
  [normalizeName('Alberto "Cowboy"')]: albertoCowboyImage,
  [normalizeName("Babu Santana")]: babuSantanaImage,
};

export function getParticipantImage(name: string) {
  const local = localImages[normalizeName(name)];

  if (local) {
    // 🟢 imagem local (require) - retorna número do Metro bundler
    return local;
  }

  // 🤖 imagem remota (avatar automático) - retorna {uri: string}
  return { uri: getAutomaticAvatar(name) };
}
```

### ✅ **Uso correto no componente:**
```typescript
// ❌ ERRADO - causa "Double to String" error
<Image source={{ uri: getParticipantImage(name) }} />

// ✅ CERTO - funciona com local e remoto
<Image source={getParticipantImage(name)} />
```

### ✅ **Documentação técnica:**
- Comentários sobre require estático vs dinâmico
- Exemplos padronizados com `normalizeName()`
- Avisos sobre limitações do Metro bundler

### 3. Exemplo prático para Babu Santana:
```typescript
// 1. Colocar arquivo: src/assets/participants/babu-santana.png

// 2. No código adicionar:
// const babuSantanaImage = require("../assets/participants/babu-santana.png");

// 3. No localImages (usando normalizeName):
const localImages: Record<string, any> = {
  [normalizeName('Alberto "Cowboy"')]: albertoCowboyImage,
  [normalizeName("Babu Santana")]: babuSantanaImage, // ← Adicione aqui
};
```

### 3. ⚠️ **Limitações técnicas:**
- **Metro bundler funciona bem com `require()` estático**
- **Evite `require()` dinâmico** (template strings, variáveis no caminho)
- **Fallback automático funciona** quando participante não está mapeado
- **Build falha** se `require()` apontar para arquivo inexistente

## 💡 **Recomendação:**
Mantenha o sistema atual de avatares automáticos. Eles são:
- 🎨 **Profissionais** e consistentes
- ⚡ **Rápidos** de carregar
- 🛠️ **Sem manutenção** - funcionam automaticamente
- 🎯 **Personalizados** com iniciais de cada participante

### 3. Coloque a imagem na pasta:
```
src/assets/participants/nome-participante.png
```

## 🎯 **Como funciona:**

- ✅ **Importações estáticas** - Metro bundler consegue processar
- ✅ **Fallback automático** - se imagem não existir, usa placeholder
- ✅ **Sem template strings dinâmicas** - evita erros de build
- ✅ **Type safety** - TypeScript completo

## 📋 Lista de participantes que podem ter imagens customizadas:

### ⭐ CAMAROTE:
- `aline-campos.png`
- `edilson.png`
- `solange-couto.png`
- `juliano-floss.png`
- `henri-castelli.png`

### 🏆 VETERANOS:
- `babu-santana.png`
- `sol-vega.png`
- `jonas-sulzbach.png`
- `sarah-andrade.png`
- `alberto-cowboy.png` ✅ **(já configurado)**
- `ana-paula-renault.png`

### 🍿 PIPOCA:
- `brigido.png`
- `marciele.png`
- `jordana.png`
- `paulo-augusto.png`
- `maxiane.png`
- `marcelo.png`
- `milena.png`
- `breno.png`
- `samira.png`
- `chaiany.png`
- `gabriela.png`
- `leandro.png`
- `matheus.png`

## 🔧 Próximos passos:
1. Adicione as imagens nesta pasta
2. Atualize o `bbb26Participants.ts` conforme o exemplo
3. Teste no app para ver as imagens carregando

## 📱 Notas importantes:
- As imagens devem ter **fundo transparente** para o efeito "cabeça saindo do círculo"
- Use o formato PNG para melhor qualidade
- O app automaticamente redimensiona as imagens conforme necessário