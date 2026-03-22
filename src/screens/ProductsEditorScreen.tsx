'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  CloudArrowDownIcon,
  StarIcon,
  XCircleIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PhotoIcon,
  CubeIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { downloadFile, formatJSON } from '../services/exportService';
import ModalConfirm from '../components/ui/ModalConfirm';
import { useNotifications } from '../hooks/useNotifications';

type ProductCategory = 'cozinha' | 'cuidados-pessoais' | 'decoracao' | 'area-externa' | 'quarto' | 'sala';
type ProductStore = 'mercadolivre' | 'shopee';

type Product = {
  id: string;
  title: string;
  subtitle?: string;
  category?: ProductCategory;
  imageUrl: string;
  affiliateUrl: string;
  store?: ProductStore;
  participantId?: string; // ID do participante associado (opcional)
  featured: boolean;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type ProductsPayload = {
  version: number;
  updatedAt: string;
  season: string;
  products: Product[];
};

type ProductFormData = {
  id: string;
  title: string;
  subtitle: string;
  category: ProductCategory | '';
  imageUrl: string;
  affiliateUrl: string;
  store: ProductStore | '';
  participantId: string;
  featured: boolean;
  active: boolean;
};

type ModalState =
  | null
  | { mode: 'create' }
  | { mode: 'edit'; product: Product };

type DeleteModalState =
  | null
  | { product: Product };

const PRODUCT_CATEGORIES = [
  { value: 'cozinha', label: 'Cozinha' },
  { value: 'cuidados-pessoais', label: 'Cuidados Pessoais' },
  { value: 'decoracao', label: 'Decoração' },
  { value: 'area-externa', label: 'Área Externa' },
  { value: 'quarto', label: 'Quarto' },
  { value: 'sala', label: 'Sala' },
] as const;

const PRODUCT_STORES = [
  { value: 'mercadolivre', label: 'Mercado Livre' },
  { value: 'shopee', label: 'Shopee' },
] as const;

// Validação estrutural de ProductsPayload (compatível com ProductsJsonPayloadSchema)
const isValidProductsPayload = (data: unknown): data is ProductsPayload => {
  if (!data || typeof data !== 'object') return false;

    // Valores válidos para categoria
  const validCategoryValues = PRODUCT_CATEGORIES.map(cat => cat.value);

  // Usar tipagem mais específica para validação runtime
  const payload = data as Partial<ProductsPayload> & {
    season?: unknown;
    products?: unknown;
  };

  // Verificações básicas obrigatórias
  if (
    typeof payload.version !== 'number' ||
    typeof payload.updatedAt !== 'string' ||
    typeof payload.season !== 'string' ||
    !Array.isArray(payload.products)
  ) {
    return false;
  }

  // Verificar cada produto
  return payload.products.every((product: unknown) => {
    if (!product || typeof product !== 'object') return false;

    const p = product as Partial<Product> & {
      subtitle?: unknown;
    };

    // Campos obrigatórios
    if (
      typeof p.id !== 'string' ||
      typeof p.title !== 'string' ||
      typeof p.imageUrl !== 'string' ||
      typeof p.affiliateUrl !== 'string' ||
      typeof p.featured !== 'boolean' ||
      typeof p.active !== 'boolean' ||
      typeof p.sortOrder !== 'number' ||
      typeof p.createdAt !== 'string' ||
      typeof p.updatedAt !== 'string'
    ) {
      return false;
    }

    // Categoria opcional; se presente, deve ser um valor válido
    const cat = (p as { category?: string }).category;
    if (cat !== undefined && cat !== null && cat !== '') {
      if (typeof cat !== 'string' || !validCategoryValues.includes(cat as ProductCategory)) {
        return false;
      }
    }

    // Campos opcionais (podem ser undefined)
    if (p.subtitle !== undefined && typeof p.subtitle !== 'string') return false;

    // Store opcional; se presente deve ser válido
    const store = (p as { store?: unknown }).store;
    if (store !== undefined && store !== null) {
      if (typeof store !== 'string' || !['mercadolivre', 'shopee'].includes(store)) {
        return false;
      }
    }

    return true;
  });
};

const FALLBACK_PRODUCT_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik0yMCAyMEgzNlYyMEgyMFptMCA0SDE2VjQ4SDE2VjI0SDR2NEg0VjIwSDIwVjI0SDIwVjIwWk0zNiAyNFYzNkgzNlYyNFoiIGZpbGw9IiM5Y2E0YWYiLz4KPC9zdmc+';

// Lista de participantes disponíveis para associação com produtos
const AVAILABLE_PARTICIPANTS = [
  // CAMAROTE
  { id: 'aline-campos', name: 'Aline Campos' },
  { id: 'edilson', name: 'Edílson' },
  { id: 'henri-castelli', name: 'Henri Castelli' },
  { id: 'juliano-floss', name: 'Juliano Floss' },
  { id: 'solange-couto', name: 'Solange Couto' },

  // VETERANOS
  { id: 'alberto-cowboy', name: 'Alberto "Cowboy"' },
  { id: 'ana-paula-renault', name: 'Ana Paula Renault' },
  { id: 'babu-santana', name: 'Babu Santana' },
  { id: 'jonas-sulzbach', name: 'Jonas Sulzbach' },
  { id: 'sarah-andrade', name: 'Sarah Andrade' },
  { id: 'sol-vega', name: 'Sol Vega' },

  // PIPOCA
  { id: 'brigido', name: 'Brígido' },
  { id: 'breno', name: 'Breno' },
  { id: 'chaiany', name: 'Chaiany' },
  { id: 'gabriela', name: 'Gabriela' },
  { id: 'jordana', name: 'Jordana' },
  { id: 'leandro', name: 'Leandro' },
  { id: 'marcelo', name: 'Marcel' },
  { id: 'marciele', name: 'Marciele' },
  { id: 'matheus', name: 'Matheus' },
  { id: 'maxiane', name: 'Maxiane' },
  { id: 'milena', name: 'Milena' },
  { id: 'paulo-augusto', name: 'Paulo Augusto' },
  { id: 'samira', name: 'Samira' },
] as const;

// Formulário vazio constante para evitar recriação
const EMPTY_FORM_DATA: ProductFormData = {
  id: '',
  title: '',
  subtitle: '',
  category: '',
  imageUrl: '',
  affiliateUrl: '',
  store: '',
  participantId: '',
  featured: false,
  active: true,
};

// Normalizar texto (remover acentos, converter para lowercase)
const normalizeText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

// Gerar ID do produto (kebab-case)
const normalizeProductId = (title: string): string => {
  return normalizeText(title)
    .replace(/[^\w\s-]/g, '') // Remove caracteres especiais exceto espaços e hífens
    .replace(/\s+/g, '-') // Substitui espaços por hífens
    .replace(/-+/g, '-') // Remove hífens consecutivos
    .replace(/^-|-$/g, ''); // Remove hífens no início/fim
};


export const ProductsEditorScreen: React.FC = () => {
  const { showSuccess, showError } = useNotifications();

  const [productsData, setProductsData] = useState<ProductsPayload | null>(null);
  const [originalProductsData, setOriginalProductsData] = useState<ProductsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Estados para filtros e busca
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'TODAS' | ProductCategory | 'SEM_CATEGORIA'>('TODAS');

  // Estados para modais
  const [productModal, setProductModal] = useState<ModalState>(null);
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>(null);
  const [discardModal, setDiscardModal] = useState<{
    isOpen: boolean;
    onConfirm: () => void;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
  } | null>(null);

  // Estado para formulário
  const [formData, setFormData] = useState<ProductFormData>(EMPTY_FORM_DATA);

  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [initialFormData, setInitialFormData] = useState<ProductFormData | null>(null);

  // Refs para foco
  const modalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const showErrorRef = useRef(showError);

  // Helpers para limpeza e foco
  const resetProductForm = () => {
    setFormData(EMPTY_FORM_DATA);
    setFormErrors([]);
    setInitialFormData(null);
  };

  const restoreTriggerFocus = () => {
    if (modalTriggerRef.current) {
      requestAnimationFrame(() => {
        modalTriggerRef.current?.focus();
      });
    }
    modalTriggerRef.current = null;
  };

  // Validar dados do produto
  const validateProduct = (
    product: Partial<Product>,
    existingProducts: Product[] = [],
    editingProductId?: string
  ): string[] => {
    const errors: string[] = [];

    // ID obrigatório
    if (!product.id?.trim()) {
      errors.push('ID do produto é obrigatório');
    } else {
      // ID deve ser único
      const duplicated = existingProducts.some(
        p => p.id === product.id && p.id !== editingProductId
      );

      if (duplicated) {
        errors.push('ID do produto já existe. Escolha um ID único.');
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
    if (product.category && !PRODUCT_CATEGORIES.some(cat => cat.value === product.category)) {
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

    // Loja virtual opcional; se informada, deve ser válida
    if (product.store && !PRODUCT_STORES.some(s => s.value === product.store)) {
      errors.push('Loja virtual inválida');
    }

    return errors;
  };

  // Verificar se formulário foi modificado (memoizado para performance)
  const hasDraftFormChanges = useMemo(() => {
    if (!initialFormData) return false;

    const normalizedCurrent = {
      ...formData,
      subtitle: formData.subtitle?.trim() || undefined,
    };

    const normalizedInitial = {
      ...initialFormData,
      subtitle: initialFormData.subtitle?.trim() || undefined,
    };

    return JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedInitial);
  }, [formData, initialFormData]);

  // Indicar se há mudanças não publicadas na lista de produtos
  const hasUnpublishedListChanges = useMemo(() => {
    if (!productsData || !originalProductsData) return false;

    const currentNormalized = {
      ...productsData,
      products: [...productsData.products].sort((a: Product, b: Product) => a.sortOrder - b.sortOrder),
    };

    const originalNormalized = {
      ...originalProductsData,
      products: [...originalProductsData.products].sort((a: Product, b: Product) => a.sortOrder - b.sortOrder),
    };

    return JSON.stringify(currentNormalized) !== JSON.stringify(originalNormalized);
  }, [productsData, originalProductsData]);

  // Indicar se há mudanças no formulário não aplicadas (agora memoizado acima)

  // Indicar se há mudanças pendentes
  const hasAnyPendingChanges = hasUnpublishedListChanges || hasDraftFormChanges;

  // Atualizar campo do formulário
  const updateFormField = <K extends keyof ProductFormData>(
    field: K,
    value: ProductFormData[K]
  ) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };

      // Auto-normalizar ID baseado no título
      if (field === 'title' && productModal?.mode !== 'edit') {
        next.id = normalizeProductId(String(value));
      }

      return next;
    });

    // Limpar erros de validação quando alterar campos
    setFormErrors([]);
  };

  // Abrir modal para adicionar produto
  const handleAddProduct = (buttonRef?: HTMLButtonElement) => {
    setFormData({ ...EMPTY_FORM_DATA });
    setInitialFormData({ ...EMPTY_FORM_DATA });
    setFormErrors([]);
    setProductModal({ mode: 'create' });
    modalTriggerRef.current = buttonRef || null;
  };

  // Abrir modal para editar produto
  const handleEditProduct = (product: Product, buttonRef?: HTMLButtonElement) => {
    const initialData: ProductFormData = {
      id: product.id,
      title: product.title,
      subtitle: product.subtitle || '',
      category: product.category ?? '',
      imageUrl: product.imageUrl,
      affiliateUrl: product.affiliateUrl,
      store: product.store ?? '',
      participantId: product.participantId || '',
      featured: product.featured,
      active: product.active,
    };

    setFormData(initialData);
    setInitialFormData(initialData);
    setFormErrors([]);
    setProductModal({ mode: 'edit', product });
    modalTriggerRef.current = buttonRef || null;
  };

  // Salvar produto do formulário
  const handleSaveProduct = async () => {
    if (!productsData || !productModal || isSavingProduct) return;

    setIsSavingProduct(true);

    try {
      // Sanitizar dados do formulário (categoria vazia = sem categoria)
      const categoryValue = formData.category?.trim();
      const category: ProductCategory | undefined = categoryValue && PRODUCT_CATEGORIES.some(c => c.value === categoryValue)
        ? (categoryValue as ProductCategory)
        : undefined;
      const sanitizedData = {
        ...formData,
        title: formData.title.trim(),
        subtitle: formData.subtitle?.trim() || undefined,
        participantId: formData.participantId?.trim() || undefined,
        affiliateUrl: formData.affiliateUrl.trim(),
        imageUrl: formData.imageUrl.trim(),
        category,
        store: formData.store || undefined,
      };

      // Criar dados finais do produto
      const productData = sanitizedData;

      // Validar dados com função local
      const validationErrors = validateProduct(
        productData,
        productsData.products,
        productModal.mode === 'edit' ? productModal.product.id : undefined
      );
      if (validationErrors.length > 0) {
        setFormErrors(validationErrors);
        return;
      }

      const now = new Date().toISOString();
      let updatedProducts: Product[];

      if (productModal.mode === 'edit' && productModal.product) {
        // Editando produto existente - preservar dados originais (createdAt)
        updatedProducts = productsData.products.map((p: Product) =>
          p.id === productModal.product.id
            ? {
                ...p,
                ...productData,
                updatedAt: now,
              }
            : p
        );
      } else {
        // Adicionando novo produto - sempre no final da lista
        const nextSortOrder = productsData.products.length;
        const newProduct = {
          ...productData,
          sortOrder: nextSortOrder,
          createdAt: now,
          updatedAt: now,
        };
        updatedProducts = [...productsData.products, newProduct];
      }

      // Reordenar produtos (com spread para evitar mutação)
      updatedProducts = [...updatedProducts].sort((a: Product, b: Product) => a.sortOrder - b.sortOrder);

      setProductsData({
        ...productsData,
        products: updatedProducts,
      });

      resetProductForm();
      setProductModal(null);
      showSuccess(productModal.mode === 'edit' ? 'Produto atualizado!' : 'Produto adicionado!');
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      showError('Erro ao salvar produto');
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Confirmar exclusão
  const handleDeleteProduct = async () => {
    if (!deleteModal || !productsData || isPublishing || isSavingProduct) return;

    try {
      // Verificar se o produto ainda existe antes de excluir
      const exists = productsData.products.some(
        (p: Product) => p.id === deleteModal.product.id
      );
      if (!exists) {
        setDeleteModal(null);
        showError('O produto não foi encontrado para exclusão');
        return;
      }

      // Fechar modal de produto se estiver editando o item que será excluído
      if (productModal?.mode === 'edit' && productModal.product.id === deleteModal.product.id) {
        resetProductForm();
        setProductModal(null);
      }

      // Atualização baseada no estado anterior para evitar race condition
      setProductsData(prev => {
        if (!prev) return prev;

        const updatedProducts = prev.products
          .filter((p: Product) => p.id !== deleteModal.product.id)
          .map((p: Product, index: number) => ({ ...p, sortOrder: index }));

        return {
          ...prev,
          products: updatedProducts,
        };
      });

      setDeleteModal(null);
      showSuccess('Produto removido!');
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      showError('Erro ao excluir produto');
    }
  };

  // Salvar dados no servidor (implementação interna com retry)
  const saveProductsData = async (
    dataToSave?: ProductsPayload,
    baseVersion?: number,
    retryCount = 0
  ) => {
    const sourceData = dataToSave ?? productsData;
    const expectedVersion = baseVersion ?? originalProductsData?.version;

    if (!sourceData) return;

    try {
      setIsPublishing(true);

      console.log(`💾 Tentativa de salvamento ${retryCount + 1}`, {
        currentVersion: sourceData.version,
        expectedVersion,
        hasOriginalData: expectedVersion !== undefined,
      });

      const updatedData = {
        ...sourceData,
        version: sourceData.version + 1,
        updatedAt: new Date().toISOString(),
      };

      const response = await fetch('/api/save-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || 'admin-bbb26-dev-key',
        },
        body: JSON.stringify({
          data: updatedData,
          expectedVersion,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Erro ao salvar produtos';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;

          if (errorData.error === 'Conflito de versão' && retryCount < 2) {
            console.log(`🔄 Conflito de versão detectado (tentativa ${retryCount + 1})`, {
              currentVersion: errorData.currentVersion,
              expectedVersion: errorData.expectedVersion,
            });

            try {
              const reloadResponse = await fetch(`/api/debug-products?t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                  'Pragma': 'no-cache'
                }
              });
              if (reloadResponse.ok) {
                const freshData = await reloadResponse.json();
                if (isValidProductsPayload(freshData)) {
                  console.log('📥 Dados recarregados com sucesso:', {
                    newVersion: freshData.version,
                    updatedAt: freshData.updatedAt,
                  });

                  // IMPORTANTE: Não sobrescrever productsData para não perder modificações locais!
                  // Apenas atualizar originalProductsData com a versão fresca
                  setOriginalProductsData(freshData);

                  if (retryCount === 0) {
                    showSuccess('Dados do servidor atualizados. Tentando salvar novamente...');
                  }

                  console.log('🔄 Iniciando retry após reload:', {
                    freshVersion: freshData.version,
                    expectedForRetry: freshData.version,
                    dataVersionForRetry: sourceData.version + 1, // Manter versão local
                    retryCount: retryCount + 1
                  });

                  // Alinhar snapshot local com versão fresca para retry consistente
                  const mergedRetryData: ProductsPayload = {
                    ...sourceData,
                    version: freshData.version, // Alinhar versão com dados frescos
                  };

                  console.log('🔄 Dados mesclados para retry:', {
                    originalVersion: sourceData.version,
                    freshVersion: freshData.version,
                    mergedVersion: mergedRetryData.version,
                    expectedForRetry: freshData.version
                  });

                  // Retry com dados mesclados + expectedVersion fresca
                  return saveProductsData(
                    mergedRetryData, // Dados alinhados com versão fresca
                    freshData.version, // Usar versão fresca como expected
                    retryCount + 1
                  );
                }
              }
            } catch (reloadError) {
              console.warn('❌ Erro ao recarregar dados:', reloadError);
            }
          }
        } catch {
          // Se não conseguir fazer parse do erro, usa a mensagem padrão
        }
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      console.log('✅ Salvamento bem-sucedido:', {
        newVersion: responseData.version,
        backup: responseData.backup,
        retryCount,
      });

      // Usar dados retornados pelo servidor para consistência, ou fallback para calculados localmente
      const savedData = responseData.data ?? updatedData;
      setProductsData(savedData);
      setOriginalProductsData(savedData);

      const successMessage = responseData.backup
        ? `Produtos salvos com sucesso! (Backup: ${responseData.backup})`
        : 'Produtos salvos com sucesso!';

      showSuccess(successMessage);
    } catch (error) {
      console.error('❌ Erro final no salvamento:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

      if (errorMessage.includes('Conflito de versão') && retryCount >= 2) {
        showError('Não foi possível salvar devido a conflitos de versão. Recarregue a página e tente novamente.');
      } else {
        showError(`Erro ao salvar: ${errorMessage}`);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  // Wrapper público para handleSave (compatível com onClick)
  const handleSave = () => saveProductsData(productsData || undefined, originalProductsData?.version);

  // Baixar JSON
  const handleDownload = () => {
    if (!productsData) return;

    try {
      const filename = `products-status-${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(filename, formatJSON(productsData));
      showSuccess('JSON baixado com sucesso!');
    } catch (error) {
      console.error('Erro ao baixar JSON:', error);
      showError('Erro ao baixar JSON');
    }
  };

  // Mostrar modal de confirmação para descartar alterações
  const showDiscardModal = (
    onConfirm: () => void,
    options?: {
      title?: string;
      message?: string;
      confirmText?: string;
      cancelText?: string;
    }
  ) => {
    setDiscardModal({
      isOpen: true,
      onConfirm,
      title: options?.title,
      message: options?.message,
      confirmText: options?.confirmText,
      cancelText: options?.cancelText,
    });
  };

  // Fechar modal com confirmação se houver alterações
  const closeProductModal = () => {
    if (hasDraftFormChanges) {
      showDiscardModal(() => {
        resetProductForm();
        setProductModal(null);
        restoreTriggerFocus();
      }, {
        title: 'Descartar alterações',
        message: 'Você tem alterações não salvas no formulário. Deseja realmente descartá-las?',
        confirmText: 'Descartar',
        cancelText: 'Continuar editando',
      });
    } else {
      resetProductForm();
      setProductModal(null);
      restoreTriggerFocus();
    }
  };

  useEffect(() => {
    showErrorRef.current = showError;
  }, [showError]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(`/api/debug-products?t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });

        if (!response.ok) {
          throw new Error('Falha ao carregar produtos');
        }

        const data = await response.json();

        if (!isValidProductsPayload(data)) {
          throw new Error('Formato de produtos inválido');
        }

        setProductsData(data);
        setOriginalProductsData(data);
        setLoadError(null);
      } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        setLoadError(`Não foi possível carregar os produtos: ${errorMessage}`);
        showErrorRef.current('Erro ao carregar produtos');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!productsData?.products) return [];

    let filtered = productsData.products;

    // Filtro de busca
    if (searchTerm.trim()) {
      const term = normalizeText(searchTerm);
      filtered = filtered.filter((product: Product) =>
        normalizeText(product.title || '').includes(term) ||
        normalizeText(product.subtitle || '').includes(term) ||
        normalizeText(product.category || '').includes(term)
      );
    }

    // Filtro de categoria
    if (categoryFilter === 'SEM_CATEGORIA') {
      filtered = filtered.filter((product: Product) => !product.category);
    } else if (categoryFilter !== 'TODAS') {
      filtered = filtered.filter((product: Product) => product.category === categoryFilter);
    }

    return filtered;
  }, [productsData, searchTerm, categoryFilter]);

  const stats = useMemo(() => {
    if (!productsData?.products) return { total: 0, ativos: 0, destaques: 0 };

    return {
      total: productsData.products.length,
      ativos: productsData.products.filter((p: Product) => p.active).length,
      destaques: productsData.products.filter((p: Product) => p.featured).length,
    };
  }, [productsData]);

  // Foco automático e ESC para modal
  useEffect(() => {
    if (!productModal) {
      document.body.style.overflow = '';
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !discardModal) {
        closeProductModal();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    // Foco automático no campo título
    requestAnimationFrame(() => {
      titleInputRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [productModal, discardModal, hasDraftFormChanges]);

  // Proteção contra saída da página com alterações não salvas
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasAnyPendingChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    if (hasAnyPendingChanges) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasAnyPendingChanges]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header Skeleton */}
        <header className="sticky top-0 z-30 bg-white shadow-sm border-b border-gray-200">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-6">
                <div>
                  <div className="h-8 bg-gray-200 rounded w-48 animate-pulse mb-1"></div>
                  <div className="h-4 bg-gray-100 rounded w-64 animate-pulse"></div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-5 bg-indigo-100 rounded-full w-16 animate-pulse"></div>
                  <div className="h-5 bg-amber-100 rounded-full w-20 animate-pulse"></div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-9 bg-indigo-100 rounded-lg w-20 animate-pulse"></div>
                <div className="h-9 bg-gray-100 rounded-lg w-24 animate-pulse"></div>
                <div className="h-9 bg-orange-100 rounded-lg w-16 animate-pulse"></div>
              </div>
            </div>
          </div>
        </header>

        <main className="py-6 pb-10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="space-y-6">
              {/* Stats Skeleton */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-gray-200 rounded-lg w-9 h-9 animate-pulse"></div>
                      <div>
                        <div className="h-4 bg-gray-200 rounded w-12 animate-pulse mb-1"></div>
                        <div className="h-3 bg-gray-100 rounded w-20 animate-pulse"></div>
                      </div>
                    </div>
                    <div className="h-8 bg-gray-200 rounded w-16 animate-pulse"></div>
                  </div>
                ))}
              </div>

              {/* Banner Skeleton */}
              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-1 bg-amber-100 rounded-lg w-6 h-6 animate-pulse"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-amber-200 rounded w-64 animate-pulse mb-1"></div>
                    <div className="h-3 bg-amber-100 rounded w-full animate-pulse"></div>
                  </div>
                </div>
              </div>

              {/* Filters Skeleton */}
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                  <div className="flex flex-col sm:flex-row gap-3 flex-1 min-w-0">
                    <div className="h-11 bg-gray-200 rounded-lg w-full max-w-md animate-pulse"></div>
                    <div className="h-11 bg-gray-200 rounded-lg w-40 animate-pulse"></div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-24 animate-pulse"></div>
                </div>
              </div>

              {/* Products List Skeleton */}
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="w-20 h-20 bg-gray-200 rounded-lg animate-pulse flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse mb-2"></div>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="h-6 bg-gray-200 rounded-full w-16 animate-pulse"></div>
                            <div className="h-6 bg-gray-200 rounded-full w-20 animate-pulse"></div>
                          </div>
                        </div>
                        <div className="h-4 bg-gray-100 rounded w-1/2 animate-pulse mb-3"></div>
                        <div className="flex items-center gap-4 mb-3">
                          <div className="h-4 bg-gray-200 rounded w-12 animate-pulse"></div>
                          <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <div className="h-8 bg-indigo-100 rounded-full w-20 animate-pulse"></div>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="h-8 w-8 bg-gray-200 rounded-lg animate-pulse"></div>
                            <div className="h-8 w-8 bg-gray-200 rounded-lg animate-pulse"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-gray-100 rounded-xl p-8 text-center shadow-sm">
          <div className="mb-4">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-400 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erro ao carregar produtos</h2>
          <p className="text-sm text-gray-600 mb-6">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-transparent text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            <CloudArrowDownIcon className="h-4 w-4" />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white shadow-sm border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
            {/* Seção esquerda - Título e botões */}
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Editor de Produtos
                </h1>
                <p className="text-sm text-gray-600">
                  Gerencie o products-status.json do app BBB
                </p>
              </div>

              {/* Badges compactos */}
              <div className="flex items-center gap-2">
                {/* Badge de loading/processamento */}
                {(isSavingProduct || isPublishing) && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 border border-indigo-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    {isSavingProduct ? 'Salvando...' : 'Publicando...'}
                  </span>
                )}

                {/* Badge de alterações não salvas */}
                {hasAnyPendingChanges && !isSavingProduct && !isPublishing && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 border border-amber-200/50">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Não salvo
                  </span>
                )}
              </div>
            </div>

            {/* Seção central - Botões principais */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={isPublishing || !hasUnpublishedListChanges || !!productModal}
                className="inline-flex items-center gap-2 h-9 px-3 py-1.5 text-sm font-semibold rounded-lg border border-transparent text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition-colors"
                title={productModal ? 'Feche o modal de produto antes de publicar' : ''}
              >
                {isPublishing ? (
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/60 border-t-white animate-spin" />
                ) : (
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                )}
                {isPublishing ? 'Publicando...' : 'Salvar'}
              </button>

              <button
                onClick={(e) => handleAddProduct(e.currentTarget)}
                disabled={isSavingProduct || isPublishing}
                className="inline-flex items-center gap-2 h-9 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Adicionar
              </button>

              <button
                onClick={handleDownload}
                disabled={!productsData}
                className="inline-flex items-center gap-2 h-9 px-3 py-1.5 text-sm font-medium rounded-lg border border-orange-200 text-orange-800 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 transition-colors"
              >
                <CloudArrowDownIcon className="h-3.5 w-3.5" />
                Download
              </button>
            </div>

            {/* Seção direita - Informações compactas */}
            <div className="xl:text-right text-xs text-gray-500 self-start xl:self-auto">
              <div className="font-medium text-gray-700">
                v{productsData?.version}
              </div>
              <div>
                {productsData?.updatedAt ? new Date(productsData.updatedAt).toLocaleDateString('pt-BR') : 'Nunca'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="py-6 pb-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            {/* Estatísticas */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-indigo-50/30 p-5 rounded-xl border border-indigo-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <CubeIcon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-indigo-900">Total</div>
                    <div className="text-xs text-indigo-600">produtos cadastrados</div>
                  </div>
                </div>
                <div className="text-3xl font-bold text-indigo-900">{stats.total}</div>
              </div>
              <div className="bg-emerald-50/30 p-5 rounded-xl border border-emerald-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <EyeIcon className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-emerald-900">Ativos</div>
                    <div className="text-xs text-emerald-600">visíveis no app</div>
                  </div>
                </div>
                <div className="text-3xl font-bold text-emerald-900">{stats.ativos}</div>
              </div>
              <div className="bg-amber-50/30 p-5 rounded-xl border border-amber-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <StarIcon className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-amber-900">Destaques</div>
                    <div className="text-xs text-amber-600">em evidência</div>
                  </div>
                </div>
                <div className="text-3xl font-bold text-amber-900">{stats.destaques}</div>
              </div>
            </div>

            {/* Banner informativo */}
            <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="p-1 bg-amber-100 rounded-lg">
                  <ExclamationTriangleIcon className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-900">
                    Os produtos do app BBB não exibem preço.
                  </p>
                  <p className="mt-1 text-sm text-amber-700">
                    Cadastre o produto com imagem, título, categoria e link afiliado. O CTA no app será sempre "VER OFERTA".
                  </p>
                </div>
              </div>
            </div>

            {/* Filtros - Toolbar */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                {/* Lado esquerdo - Busca e filtros */}
                <div className="flex flex-col sm:flex-row gap-3 flex-1 min-w-0">
                  <div className="relative flex-1 max-w-md">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar produtos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-gray-400 transition-colors"
                    />
                  </div>

                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as 'TODAS' | ProductCategory | 'SEM_CATEGORIA')}
                    className="h-11 px-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors min-w-[140px]"
                  >
                    <option value="TODAS">Todas as categorias</option>
                    <option value="SEM_CATEGORIA">Sem categoria</option>
                    {PRODUCT_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>

                  {(searchTerm || categoryFilter !== 'TODAS') && (
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setCategoryFilter('TODAS');
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 h-11 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <XMarkIcon className="h-4 w-4" />
                      Limpar filtros
                    </button>
                  )}
                </div>

                {/* Lado direito - Chips de categoria rápida e contador */}
                <div className="flex items-center gap-3">
                  {/* Contador de resultados */}
                  <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border">
                    <span className="font-medium text-gray-900">{filteredProducts.length}</span> resultado{filteredProducts.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Chips de categoria rápida - visíveis apenas no mobile */}
              <div className="flex md:hidden items-center gap-2 mt-4 overflow-x-auto">
                <button
                  onClick={() => setCategoryFilter(categoryFilter === 'SEM_CATEGORIA' ? 'TODAS' : 'SEM_CATEGORIA')}
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    categoryFilter === 'SEM_CATEGORIA'
                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  Sem categoria
                </button>
                {PRODUCT_CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setCategoryFilter(categoryFilter === cat.value ? 'TODAS' : cat.value)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                      categoryFilter === cat.value
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de Produtos */}
            <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="mb-4">
                    <CubeIcon className="h-12 w-12 text-gray-300 mx-auto" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {searchTerm || categoryFilter !== 'TODAS' ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
                  </h3>
                  <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                    {searchTerm || categoryFilter !== 'TODAS'
                      ? 'Tente ajustar os filtros de busca ou categoria para encontrar produtos.'
                      : 'Adicione o primeiro item para começar a montar a vitrine de produtos do app BBB.'
                    }
                  </p>
                  {(!searchTerm && categoryFilter === 'TODAS') && (
                    <button
                      onClick={(e) => handleAddProduct(e.currentTarget)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-transparent text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                    >
                      <PlusIcon className="h-4 w-4" />
                      Adicionar Produto
                    </button>
                  )}
                </div>
              ) : (
                filteredProducts.map((product: Product) => (
                  <div key={product.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 h-full">
                    <div className="flex h-full items-start gap-4">
                      <div className="flex-shrink-0">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.title}
                            className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                              e.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
                            }}
                          />
                        ) : (
                          <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                            <span className="text-gray-400 text-xs">IMG</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col h-full">
                        {/* Linha 1: Título com badges de status no topo direito */}
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900 leading-tight line-clamp-2">{product.title}</h3>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-1 flex-shrink-0 max-w-[50%]">
                            {product.featured && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                <StarIcon className="h-3 w-3" />
                                Destaque
                              </span>
                            )}
                            {!product.active && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                                <XCircleIcon className="h-3 w-3" />
                                Inativo
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Linha 2: Subtítulo */}
                        {product.subtitle && (
                          <p className="text-sm text-gray-600 mb-3">{product.subtitle}</p>
                        )}

                        {/* Linha 3: Metadados secundários */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-3">
                          <span className="font-mono bg-gray-50 px-2 py-1 rounded-md border border-gray-100">{product.id}</span>
                          <span className="bg-gray-50 px-2 py-1 rounded-md border border-gray-100">{product.category ? PRODUCT_CATEGORIES.find(c => c.value === product.category)?.label : 'Sem categoria'}</span>
                          <span className="bg-gray-50 px-2 py-1 rounded-md border border-gray-100">{product.store ? PRODUCT_STORES.find(s => s.value === product.store)?.label : '—'}</span>
                          <span className="bg-gray-50 px-2 py-1 rounded-md border border-gray-100">Ordem: {product.sortOrder}</span>
                        </div>

                        {/* Espaçamento flexível para empurrar ações para o rodapé */}
                        <div className="flex-1"></div>

                        {/* Linha 4: Ações - sempre no rodapé */}
                        <div className="flex items-center justify-end gap-4">

                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => handleEditProduct(product, e.currentTarget)}
                              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-200 group"
                              title="Editar produto"
                            >
                              <PencilIcon className="h-4 w-4 group-hover:scale-110 transition-transform" />
                            </button>
                            <button
                              onClick={() => setDeleteModal({ product })}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 group"
                              title="Excluir produto"
                            >
                              <TrashIcon className="h-4 w-4 group-hover:scale-110 transition-transform" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      </main>

      {/* Modal de Produto */}
      {productModal && (
        <>
          {/* Overlay - só mostra se não há modal de descarte ou exclusão */}
          {!discardModal && !deleteModal && (
            <div
              aria-hidden="true"
              className="fixed inset-0 bg-gray-500/75 z-40"
              onClick={closeProductModal}
            />
          )}

          {/* Modal Content - só mostra se não há modal de descarte ou exclusão */}
          {!discardModal && !deleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
            className="w-full max-w-6xl max-h-[90vh] rounded-2xl bg-white shadow-xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
              {/* Header Fixo */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
                <h3 id="product-modal-title" className="text-xl font-semibold text-gray-900">
                  {productModal.mode === 'edit' ? 'Editar Produto' : 'Novo Produto'}
                </h3>
                <button
                  onClick={closeProductModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Fechar modal"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Corpo com Scroll */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-6">
                  {/* Erros de validação */}
                  {formErrors.length > 0 && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                        <span className="text-sm font-medium text-red-800">Erros de validação:</span>
                      </div>
                      <ul className="text-sm text-red-700 space-y-1">
                        {formErrors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Grid de 2 colunas */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Coluna Esquerda - Formulário */}
                    <div className="space-y-8">
                      {/* Identificação */}
                      <div>
                        <h3 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-4 border-b border-gray-100 pb-2">
                          Identificação
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">ID *</label>
                            <input
                              type="text"
                              value={formData.id}
                              onChange={(e) => updateFormField('id', e.target.value)}
                              onBlur={(e) => {
                                if (productModal.mode === 'create') {
                                  updateFormField('id', normalizeProductId(e.target.value));
                                }
                              }}
                              placeholder="sofa-bege-sala"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-white placeholder:text-gray-400 transition-colors hover:border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              disabled={productModal.mode === 'edit'}
                            />
                            <p className="text-xs text-gray-500 mt-1">Formato kebab-case, será gerado automaticamente</p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Título *</label>
                            <input
                              ref={titleInputRef}
                              type="text"
                              value={formData.title}
                              onChange={(e) => updateFormField('title', e.target.value)}
                              placeholder="Sofá Bege 3 Lugares"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-white placeholder:text-gray-400 transition-colors hover:border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                            <select
                              value={formData.category}
                              onChange={(e) => updateFormField('category', e.target.value as ProductCategory | '')}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-white transition-colors hover:border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                              <option value="">Sem categoria</option>
                              {PRODUCT_CATEGORIES.map(cat => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Conteúdo */}
                      <div>
                        <h3 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-4 border-b border-gray-100 pb-2">
                          Conteúdo
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Participante Associado</label>
                            <select
                              value={formData.participantId}
                              onChange={(e) => updateFormField('participantId', e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-white transition-colors hover:border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                              <option value="">Nenhum participante</option>
                              {AVAILABLE_PARTICIPANTS.map(participant => (
                                <option key={participant.id} value={participant.id}>
                                  {participant.name}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                              Opcional: associe este produto a um participante do BBB26
                            </p>

                            {/* Preview da badge do participante */}
                            {formData.participantId && (
                              <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex items-center gap-3">
                                  <div className="text-xs text-gray-600 font-medium">Preview da Badge:</div>
                                  <div className="relative">
                                    <div className="w-8 h-8 rounded-full border-2 border-white shadow-sm overflow-hidden bg-gray-200">
                                      <img
                                        src={`/participants/${formData.participantId}.png`}
                                        alt={AVAILABLE_PARTICIPANTS.find(p => p.id === formData.participantId)?.name || ''}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          e.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
                                        }}
                                      />
                                    </div>
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border border-white"></div>
                                  </div>
                                  <span className="text-xs text-gray-600">
                                    {AVAILABLE_PARTICIPANTS.find(p => p.id === formData.participantId)?.name}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Subtítulo</label>
                            <input
                              type="text"
                              value={formData.subtitle}
                              onChange={(e) => updateFormField('subtitle', e.target.value)}
                              placeholder="Parecido com o da sala"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-white placeholder:text-gray-400 transition-colors hover:border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>

                        </div>
                      </div>

                      {/* Links */}
                      <div>
                        <h3 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-4 border-b border-gray-100 pb-2">
                          Links
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Loja virtual</label>
                            <select
                              value={formData.store}
                              onChange={(e) => updateFormField('store', e.target.value as ProductStore | '')}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-white transition-colors hover:border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                              <option value="">Selecione...</option>
                              {PRODUCT_STORES.map(store => (
                                <option key={store.value} value={store.value}>{store.label}</option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Será usado no Central BBB para exibir o badge da loja</p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">URL da Imagem *</label>
                            <input
                              type="url"
                              value={formData.imageUrl}
                              onChange={(e) => updateFormField('imageUrl', e.target.value)}
                              placeholder="https://exemplo.com/imagem.jpg"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-white placeholder:text-gray-400 transition-colors hover:border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">URL do Afiliado *</label>
                            <input
                              type="url"
                              value={formData.affiliateUrl}
                              onChange={(e) => updateFormField('affiliateUrl', e.target.value)}
                              placeholder="https://mercadolivre.com.br/..."
                              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-white placeholder:text-gray-400 transition-colors hover:border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Exibição no app */}
                      <div>
                        <h3 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-4 border-b border-gray-100 pb-2">
                          Exibição no app
                        </h3>
                        <div className="space-y-3">
                          <label className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={formData.featured}
                              onChange={(e) => updateFormField('featured', e.target.checked)}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-200 rounded"
                            />
                            <span className="text-sm font-medium text-gray-700">Produto em destaque</span>
                          </label>

                          <label className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={formData.active}
                              onChange={(e) => updateFormField('active', e.target.checked)}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-200 rounded"
                            />
                            <span className="text-sm font-medium text-gray-700">Produto ativo</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Coluna Direita - Preview Sticky */}
                    <div className="lg:sticky lg:top-6 self-start">
                      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                        <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <PhotoIcon className="h-4 w-4 text-indigo-600" />
                          Preview do card no app
                        </h4>

                        {/* Frame do Mobile */}
                        <div className="bg-gray-100 rounded-2xl p-4 border border-gray-200">
                          <div className="bg-gray-900 rounded-xl p-3">
                            {/* Status Bar */}
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-white text-xs font-medium">9:41</span>
                              <div className="flex items-center gap-1">
                                <div className="w-4 h-2 bg-white rounded-sm"></div>
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              </div>
                            </div>

                            {/* Card do App */}
                            <div className="bg-white rounded-xl p-4 shadow-lg relative overflow-hidden">
                              {/* Overlay para inativo */}
                              {!formData.active && (
                                <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    <span className="text-xs font-medium text-red-700">Produto Inativo</span>
                                  </div>
                                </div>
                              )}

                              {/* Indicadores de status */}
                              <div className="mb-3 flex items-center gap-2">
                                {!formData.active && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    Inativo
                                  </span>
                                )}
                                {formData.featured && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                    Destaque
                                  </span>
                                )}
                                {formData.store && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    {PRODUCT_STORES.find(s => s.value === formData.store)?.label}
                                  </span>
                                )}
                              </div>

                              {/* Imagem do produto */}
                              <div className="mb-3 relative">
                                {formData.imageUrl ? (
                                  <img
                                    src={formData.imageUrl}
                                    alt={formData.title || 'Produto'}
                                    className="w-full h-32 object-cover rounded-lg border border-gray-100"
                                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                      e.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-100">
                                    {/* Skeleton Loading */}
                                    <div className="animate-pulse flex space-x-4 w-full p-4">
                                      <div className="flex-1 space-y-2">
                                        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                                        <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                                      </div>
                                      <div className="h-16 w-16 bg-gray-200 rounded"></div>
                                    </div>
                                  </div>
                                )}

                                {/* Badge de categoria */}
                                <span className="absolute top-2 left-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-900/90 text-white shadow-sm">
                                  {formData.category ? PRODUCT_CATEGORIES.find(cat => cat.value === formData.category)?.label : 'Sem categoria'}
                                </span>
                              </div>

                              {/* Conteúdo do card */}
                              <div className="space-y-2">
                                {/* Título */}
                                <h3 className={`font-semibold text-sm leading-tight line-clamp-2 ${
                                  !formData.active ? 'text-gray-400' : 'text-gray-900'
                                }`}>
                                  {formData.title || 'Título do produto'}
                                </h3>

                                {/* Subtítulo */}
                                {formData.subtitle && (
                                  <p className={`text-xs leading-tight ${
                                    !formData.active ? 'text-gray-300' : 'text-gray-600'
                                  }`}>
                                    {formData.subtitle}
                                  </p>
                                )}


                                {/* Botão CTA */}
                                <div className="pt-2">
                                  <button
                                    className={`w-full text-white text-xs font-semibold py-2.5 px-4 rounded-lg transition-colors ${
                                      !formData.active
                                        ? 'bg-gray-300 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-sm'
                                    }`}
                                    disabled={!formData.active}
                                  >
                                    VER OFERTA
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Home Indicator */}
                            <div className="flex justify-center mt-3">
                              <div className="w-32 h-1 bg-white rounded-full"></div>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-gray-500 mt-4 text-center">
                          Esta é uma prévia realista de como o produto aparecerá no app BBB
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Fixo */}
              <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-white">
                <div className="text-xs text-gray-500">
                  {productModal.mode === 'edit' ? 'Atualizando produto existente' : 'Criando novo produto'}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={closeProductModal}
                    disabled={isSavingProduct}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveProduct}
                    disabled={isSavingProduct}
                    className="min-w-[180px] px-6 py-2.5 text-sm font-semibold rounded-lg border border-transparent text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {isSavingProduct ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin" />
                        Salvando...
                      </span>
                    ) : (
                      productModal.mode === 'edit' ? 'Atualizar Produto' : 'Adicionar Produto'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          )}
        </>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deleteModal && (
        <ModalConfirm
          isOpen={!!deleteModal}
          title="Excluir Produto"
          message={`Tem certeza que deseja excluir o produto "${deleteModal.product.title}"? Esta ação não pode ser desfeita.`}
          confirmText="Excluir"
          cancelText="Cancelar"
          confirmButtonColor="red"
          onConfirm={handleDeleteProduct}
          onCancel={() => setDeleteModal(null)}
          isLoading={isPublishing || isSavingProduct}
        />
      )}

      {/* Modal de Confirmação para Descartar Alterações */}
      {discardModal && !deleteModal && (
        <ModalConfirm
          isOpen={discardModal.isOpen}
          title={discardModal.title || "Descartar alterações"}
          message={discardModal.message || "Você tem alterações não salvas no formulário. Deseja realmente descartá-las?"}
          confirmText={discardModal.confirmText || "Descartar"}
          cancelText={discardModal.cancelText || "Continuar editando"}
          confirmButtonColor="blue"
          onConfirm={() => {
            discardModal.onConfirm();
            setDiscardModal(null);
          }}
          onCancel={() => setDiscardModal(null)}
        />
      )}
    </div>
  );
};