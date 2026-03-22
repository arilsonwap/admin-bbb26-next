# Lista de Participant IDs - BBB26

## 📋 Visão Geral

Este documento contém todos os `participantId` disponíveis no sistema BBB26. Estes IDs são usados no arquivo JSON remoto (`/bbb26.json`) para referenciar participantes específicos.

## 🔧 Como os IDs são Gerados

Os IDs são gerados automaticamente através da função `id()` que:

1. **Normaliza** o nome (remove acentos, converte para minúsculo)
2. **Substitui** espaços e caracteres especiais por hífens
3. **Remove** hífens no início/fim

```typescript
// Exemplo: "Babu Santana" → "babu-santana"
const id = (name: string): string =>
  normalizeKey(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
```

## 👥 Lista Completa de Participant IDs

### 📺 CAMAROTE
| Nome | Participant ID |
|------|---------------|
| Aline Campos | `aline-campos` |
| Edílson | `edilson` |
| Henri Castelli | `henri-castelli` |
| Juliano Floss | `juliano-floss` |
| Solange Couto | `solange-couto` |

### 🏆 VETERANOS
| Nome | Participant ID |
|------|---------------|
| Alberto "Cowboy" | `alberto-cowboy` |
| Ana Paula Renault | `ana-paula-renault` |
| Babu Santana | `babu-santana` |
| Jonas Sulzbach | `jonas-sulzbach` |
| Sarah Andrade | `sarah-andrade` |
| Sol Vega | `sol-vega` |

### 🎉 PIPOCA
| Nome | Participant ID |
|------|---------------|
| Brígido | `brigido` |
| Breno | `breno` |
| Chaiany | `chaiany` |
| Gabriela | `gabriela` |
| Jordana | `jordana` |
| Leandro | `leandro` |
| Marcel | `marcelo` |
| Marciele | `marciele` |
| Matheus | `matheus` |
| Maxiane | `maxiane` |
| Milena | `milena` |
| Paulo Augusto | `paulo-augusto` |
| Samira | `samira` |

## 🎯 IDs Mais Usados

### Destaques da Semana
```json
{
  "highlights": [
    {
      "participantId": "babu-santana",
      "type": "LEADER"
    },
    {
      "participantId": "samira",
      "type": "ANGEL"
    }
  ]
}
```

### Paredão
```json
{
  "paredao": [
    {
      "participantId": "leandro",
      "status": "ACTIVE"
    },
    {
      "participantId": "brigido",
      "status": "ACTIVE"
    },
    {
      "participantId": "matheus",
      "status": "ACTIVE"
    }
  ]
}
```

## 📝 Notas Importantes

### ✅ IDs Estáveis
- IDs não mudam mesmo se o nome for atualizado
- Sistema de normalização garante consistência

### ✅ Case Sensitive
- Todos os IDs são minúsculos
- Use sempre letras minúsculas

### ✅ Caracteres Especiais
- Acentos são removidos (`ã` → `a`)
- Aspas são removidas (`"` → ``)
- Espaços viram hífens (` ` → `-`)

### ✅ Exemplos de Normalização
| Nome Original | Participant ID |
|---------------|---------------|
| `Babu Santana` | `babu-santana` |
| `Alberto "Cowboy"` | `alberto-cowboy` |
| `Ana Paula Renault` | `ana-paula-renault` |
| `Edílson` | `edilson` |
| `Jonas Sulzbach` | `jonas-sulzbach` |

## 🔍 Como Encontrar um ID

### Opção 1: Console do Navegador
```javascript
// No console do navegador, com o app rodando:
console.log(participants.map(p => `${p.name}: ${p.id}`));
```

### Opção 2: Arquivo de Participantes
```bash
# Procure no arquivo src/data/bbb26Participants.ts
grep -n "make(" src/data/bbb26Participants.ts
```

### Opção 3: Busca por Nome
```javascript
// Use a função id() para gerar o ID de qualquer nome
const normalizeKey = (value) => value
  .trim()
  .replace(/\s+/g, " ")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();

const id = (name) => normalizeKey(name)
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/(^-|-$)/g, "");

console.log(id("Nome do Participante")); // resultado: "nome-do-participante"
```

## 🚨 Validação

### IDs Inválidos (Erro Comum)
```json
{
  "participantId": "Babu-Santana"  // ❌ Errado - maiúsculo
}
```

```json
{
  "participantId": "babu santana"  // ❌ Errado - espaço ao invés de hífen
}
```

```json
{
  "participantId": "babu-santana"  // ✅ Correto
}
```

## 📞 Suporte

Para adicionar novos participantes ou corrigir IDs, consulte:
- Arquivo: `src/data/bbb26Participants.ts`
- Função: `id()` e `normalizeKey()`
- Documentação: Este arquivo