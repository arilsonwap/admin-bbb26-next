# 📋 Mudanças na API de Produtos - BBB26

## 📅 Data: 10 de março de 2026
## 🔄 Versão: 4+

## 📝 Resumo das Modificações

Este documento detalha as mudanças realizadas na estrutura de dados dos produtos do BBB26 que precisam ser implementadas no aplicativo móvel que consome a API.

---

## ❌ Campos Removidos

### 1. Campo `badge` (string)
- **Status:** ❌ REMOVIDO
- **Localização:** `Product.badge`
- **Impacto:** Campo opcional que exibia badges personalizados nos produtos
- **Ação necessária:** Remover qualquer referência ou exibição de badges no app

### 2. Campo `tags` (string[])
- **Status:** ❌ REMOVIDO
- **Localização:** `Product.tags`
- **Impacto:** Array de tags para categorização adicional dos produtos
- **Ação necessária:** Remover filtros e exibições de tags

---

## ➕ Campos e Funcionalidades Adicionadas

### 1. Nova Categoria: `cuidados-pessoais`
- **Status:** ✅ ADICIONADO
- **Valor:** `"cuidados-pessoais"`
- **Label:** `"Cuidados Pessoais"`
- **Descrição:** Categoria para produtos de beleza, higiene pessoal, cuidados com cabelo, pele, etc.
- **Ação necessária:** Adicionar suporte para a nova categoria nos filtros e exibições

### 2. Campo `participantId` (string, opcional)
- **Status:** ✅ ADICIONADO
- **Localização:** `Product.participantId`
- **Descrição:** ID do participante do BBB26 associado ao produto
- **Uso:** Permite mostrar uma badge com foto do participante no card do produto
- **Ação necessária:** Implementar exibição da badge circular com foto do participante

### 3. Funcionalidade: Badge de Participante
- **Status:** ✅ ADICIONADO
- **Descrição:** Badge circular sobreposta no card do produto mostrando foto do participante
- **Implementação:** Usar `participantId` para buscar foto em `/participants/{id}.png`
- **Fallback:** Usar imagem padrão se foto não existir
- **Ação necessária:** Implementar componente visual da badge no app móvel

---

## 🔧 Estrutura Atual do Produto

```typescript
interface Product {
  id: string;                    // ✅ Mantido
  title: string;                 // ✅ Mantido
  subtitle?: string;             // ✅ Mantido
  category: ProductCategory;     // ✅ Atualizado (nova categoria)
  imageUrl: string;              // ✅ Mantido
  affiliateUrl: string;          // ✅ Mantido
  participantId?: string;        // ✅ NOVO - ID do participante associado
  featured: boolean;             // ✅ Mantido
  active: boolean;               // ✅ Mantido
  sortOrder: number;             // ✅ Mantido
  createdAt: string;             // ✅ Mantido
  updatedAt: string;             // ✅ Mantido
  // ❌ badge?: string;         // REMOVIDO
  // ❌ tags: string[];         // REMOVIDO
}

type ProductCategory =
  | 'cozinha'           // ✅ Mantido
  | 'cuidados-pessoais' // ✅ NOVO
  | 'decoracao'         // ✅ Mantido
  | 'area-externa'      // ✅ Mantido
  | 'quarto'            // ✅ Mantido
  | 'sala';             // ✅ Mantido
```

---

## 📱 Mudanças Necessárias no App Móvel

### 1. **Atualização de Tipos/Interfaces**
```typescript
// ❌ ANTES
interface Product {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  imageUrl: string;
  affiliateUrl: string;
  badge?: string;      // ❌ REMOVER
  tags: string[];      // ❌ REMOVER
  featured: boolean;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ✅ DEPOIS
interface Product {
  id: string;
  title: string;
  subtitle?: string;
  category: ProductCategory; // ✅ Atualizar tipo
  imageUrl: string;
  affiliateUrl: string;
  featured: boolean;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

type ProductCategory =
  | 'cozinha'
  | 'cuidados-pessoais' // ✅ ADICIONAR
  | 'decoracao'
  | 'area-externa'
  | 'quarto'
  | 'sala';
```

### 2. **Remover Exibição de Badges**
```typescript
// ❌ REMOVER este código
{product.badge && (
  <Badge variant="custom">
    {product.badge}
  </Badge>
)}
```

### 3. **Remover Sistema de Tags**
```typescript
// ❌ REMOVER filtros por tags
const filteredProducts = products.filter(product =>
  product.tags.some(tag => tag.includes(searchTerm))
);

// ❌ REMOVER exibição de tags
{product.tags.map(tag => (
  <Tag key={tag}>{tag}</Tag>
))}
```

### 4. **Adicionar Suporte à Nova Categoria**
```typescript
// ✅ ADICIONAR tradução da nova categoria
const categoryLabels = {
  'cozinha': 'Cozinha',
  'cuidados-pessoais': 'Cuidados Pessoais', // ✅ NOVO
  'decoracao': 'Decoração',
  'area-externa': 'Área Externa',
  'quarto': 'Quarto',
  'sala': 'Sala'
};

// ✅ ADICIONAR ícones/mapeamento visual
const categoryIcons = {
  'cozinha': '🍳',
  'cuidados-pessoais': '🧴', // ✅ NOVO
  'decoracao': '🎨',
  'area-externa': '🏡',
  'quarto': '🛏️',
  'sala': '🛋️'
};
```

### 5. **Atualizar Filtros de Categoria**
```typescript
// ✅ ADICIONAR nova categoria aos filtros
const categoryFilters = [
  { value: 'todas', label: 'Todas' },
  { value: 'cozinha', label: 'Cozinha' },
  { value: 'cuidados-pessoais', label: 'Cuidados Pessoais' }, // ✅ NOVO
  { value: 'decoracao', label: 'Decoração' },
  { value: 'area-externa', label: 'Área Externa' },
  { value: 'quarto', label: 'Quarto' },
  { value: 'sala', label: 'Sala' }
];
```

---

## 🔍 Validações e Compatibilidade

### **1. Backward Compatibility**
- ✅ **Safe:** Apps antigos receberão dados sem `badge` e `tags` (campos opcionais)
- ✅ **Safe:** Nova categoria será tratada como categoria válida
- ⚠️ **Atenção:** Apps que dependem de `tags` para filtros precisarão ser atualizados

### **2. Campos Obrigatórios**
- ✅ Todos os campos obrigatórios mantidos
- ✅ Estrutura de `Product` permanece consistente
- ✅ Campos `id`, `title`, `category`, `imageUrl`, `affiliateUrl` ainda obrigatórios

### **3. Campos Opcionais**
- ✅ `subtitle` mantido como opcional
- ✅ `featured`, `active`, `sortOrder` mantidos
- ✅ Timestamps mantidos

---

## 📋 Checklist de Implementação

### **Para Desenvolvedores do App Móvel:**

- [ ] Atualizar interfaces TypeScript
- [ ] Remover código relacionado a `badge`
- [ ] Remover código relacionado a `tags`
- [ ] Adicionar nova categoria `cuidados-pessoais`
- [ ] Atualizar filtros de categoria
- [ ] Atualizar labels e traduções
- [ ] Atualizar ícones/categorização visual
- [ ] Testar filtros e buscas
- [ ] Testar exibição de produtos
- [ ] Verificar compatibilidade com dados existentes

### **Para QA/Testes:**

- [ ] Verificar que produtos sem `badge`/`tags` exibem corretamente
- [ ] Testar filtros por categoria incluindo "Cuidados Pessoais"
- [ ] Verificar busca por texto (não deve quebrar sem tags)
- [ ] Testar ordenação e exibição de produtos
- [ ] Validar imagens e links de afiliados
- [ ] **Implementar badge de participante nos cards de produto**
- [ ] **Testar carregamento de fotos dos participantes (`/participants/{id}.png`)**
- [ ] **Validar fallback quando foto do participante não existe**

---

## 📊 Dados de Exemplo

### **Produto com Nova Categoria:**
```json
{
  "id": "shampoo-hidratante",
  "title": "Shampoo Hidratante Profissional",
  "subtitle": "Para cabelos secos e danificados",
  "category": "cuidados-pessoais",
  "imageUrl": "https://example.com/shampoo.jpg",
  "affiliateUrl": "https://example.com/comprar",
  "featured": false,
  "active": true,
  "sortOrder": 1,
  "createdAt": "2026-03-10T20:15:00.000Z",
  "updatedAt": "2026-03-10T20:15:00.000Z"
}
```

### **Produto sem Campos Removidos:**
```json
{
  "id": "sofa-bege-3-lugares",
  "title": "Sofá Bege 3 Lugares",
  "subtitle": "Modelo confortável e elegante",
  "category": "sala",
  "imageUrl": "https://example.com/sofa.jpg",
  "affiliateUrl": "https://example.com/sofa",
  "featured": true,
  "active": true,
  "sortOrder": 2,
  "createdAt": "2026-03-10T02:30:41.113Z",
  "updatedAt": "2026-03-10T02:30:41.113Z"
}
```

### Produto com Participante Associado:
```json
{
  "id": "perfume-masculino",
  "title": "Perfume Masculino Premium",
  "subtitle": "Fragrância sofisticada para homens",
  "category": "cuidados-pessoais",
  "imageUrl": "https://example.com/perfume.jpg",
  "affiliateUrl": "https://example.com/perfume",
  "participantId": "babu-santana",
  "featured": true,
  "active": true,
  "sortOrder": 10,
  "createdAt": "2026-03-10T20:15:00.000Z",
  "updatedAt": "2026-03-10T20:15:00.000Z"
}
```

---

## 🚨 Impacto e Prioridade

| Mudança | Impacto | Prioridade | Complexidade |
|---------|---------|------------|--------------|
| Remover `badge` | Baixo | Baixa | Baixa |
| Remover `tags` | Médio | Alta | Média |
| Nova categoria | Baixo | Baixa | Baixa |
| Campo `participantId` | Médio | Média | Baixa |
| Badge de participante | Alto | Alta | Média |

**Prioridade geral:** 🔴 **ALTA** - Remoção de `tags` pode quebrar filtros existentes

---

## 📞 Suporte

Para dúvidas sobre esta documentação ou implementação:
- Verificar código no admin: `src/screens/ProductsEditorScreen.tsx`
- Schema atualizado: `src/models/types.ts`
- Dados de exemplo: `tools/bbb-hosting/public/products-status.json`

**Última atualização:** 10 de março de 2026
**Versão da API:** 4+
**Responsável:** Equipe de Desenvolvimento BBB26