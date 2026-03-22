import { AdminProduct, ProductCategory, ProductsJsonPayload, ProductStore } from '../models/types';

/**
 * Versionamento do contrato JSON de produtos:
 *
 * v1: produtos tinham campos priceCurrent e priceOld
 * v2: preço removido, CTA fixo "VER OFERTA" + suporte opcional a participantId para associar produtos a participantes
 */

// Função para normalizar texto (remover acentos, converter para lowercase)
const normalizeText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

// Normalizar ID do produto (kebab-case)
export const normalizeProductId = (title: string): string => {
  return normalizeText(title)
    .replace(/[^\w\s-]/g, '') // Remove caracteres especiais exceto espaços e hífens
    .replace(/\s+/g, '-') // Substitui espaços por hífens
    .replace(/-+/g, '-') // Remove hífens consecutivos
    .replace(/^-|-$/g, ''); // Remove hífens no início/fim
};

// Validar se um ID é único entre os produtos
export const isProductIdUnique = (id: string, products: AdminProduct[], excludeId?: string): boolean => {
  return !products.some(product => product.id === id && product.id !== excludeId);
};

// Categorias disponíveis para produtos
export const PRODUCT_CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: 'cozinha', label: 'Cozinha' },
  { value: 'cuidados-pessoais', label: 'Cuidados Pessoais' },
  { value: 'decoracao', label: 'Decoração' },
  { value: 'area-externa', label: 'Área Externa' },
  { value: 'quarto', label: 'Quarto' },
  { value: 'sala', label: 'Sala' },
];

export const PRODUCT_STORES: { value: ProductStore; label: string }[] = [
  { value: 'mercadolivre', label: 'Mercado Livre' },
  { value: 'shopee', label: 'Shopee' },
];

// Validar dados de um produto
export const validateProduct = (
  product: Partial<AdminProduct>,
  existingProducts: AdminProduct[] = [],
  excludeId?: string
): string[] => {
  const errors: string[] = [];

  // ID obrigatório
  if (!product.id?.trim()) {
    errors.push('ID do produto é obrigatório');
  } else {
    // ID deve ser único
    if (!isProductIdUnique(product.id, existingProducts, excludeId)) {
      errors.push('ID do produto já existe');
    }

    // ID deve estar em kebab-case
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(product.id)) {
      errors.push('ID deve estar em formato kebab-case (ex: sofa-bege-sala)');
    }
  }

  // Título obrigatório
  if (!product.title?.trim()) {
    errors.push('Título do produto é obrigatório');
  }

  // Categoria opcional; se informada, deve ser válida
  if (product.category != null && !PRODUCT_CATEGORIES.some(cat => cat.value === product.category)) {
    errors.push('Categoria inválida');
  }

  // URL da imagem obrigatória
  if (!product.imageUrl?.trim()) {
    errors.push('URL da imagem é obrigatória');
  } else {
    try {
      new URL(product.imageUrl);
    } catch {
      errors.push('URL da imagem deve ser uma URL válida');
    }
  }


  // URL do afiliado obrigatória
  if (!product.affiliateUrl?.trim()) {
    errors.push('URL do afiliado é obrigatória');
  } else {
    try {
      new URL(product.affiliateUrl);
    } catch {
      errors.push('URL do afiliado deve ser uma URL válida');
    }
  }

  // Store opcional; se informada, deve ser válida
  if (product.store != null && !PRODUCT_STORES.some(s => s.value === product.store)) {
    errors.push('Loja virtual inválida');
  }


  // Featured e active obrigatórios
  if (typeof product.featured !== 'boolean') {
    errors.push('Status de destaque é obrigatório');
  }

  if (typeof product.active !== 'boolean') {
    errors.push('Status ativo é obrigatório');
  }

  return errors;
};

// Criar produto com valores padrão
export const createDefaultProduct = (): Omit<AdminProduct, 'createdAt' | 'updatedAt' | 'sortOrder'> => {
  return {
    id: '',
    title: '',
    subtitle: '',
    category: undefined,
    imageUrl: '',
    affiliateUrl: '',
    participantId: '',
    featured: false,
    active: true,
  };
};

// Criar estrutura inicial de produtos
export const createInitialProductsPayload = (): ProductsJsonPayload => {
  return {
    version: 2, // v2: preço removido, CTA fixo "VER OFERTA"
    updatedAt: new Date().toISOString(),
    season: 'BBB26',
    products: [],
  };
};

// Ordenar produtos por sortOrder
export const sortProductsByOrder = (products: AdminProduct[]): AdminProduct[] => {
  return [...products].sort((a, b) => a.sortOrder - b.sortOrder);
};

// Encontrar próximo sortOrder disponível
export const getNextSortOrder = (products: AdminProduct[]): number => {
  if (products.length === 0) return 0;
  const maxOrder = Math.max(...products.map(p => p.sortOrder));
  return maxOrder + 1;
};

// Reordenar produtos após mudança de sortOrder
export const reorderProducts = (products: AdminProduct[], movedProductId: string, newSortOrder: number): AdminProduct[] => {
  const updatedProducts = products.map(product => {
    if (product.id === movedProductId) {
      return { ...product, sortOrder: newSortOrder, updatedAt: new Date().toISOString() };
    }
    return product;
  });

  // Reordenar automaticamente os produtos afetados
  return sortProductsByOrder(updatedProducts);
};