'use client';

import React, { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '../store/adminStore';
import { useAdminApp } from '../hooks/useAdminApp';
import { exportAllFilesAsZip } from '../services/exportService';

export const KeyboardShortcuts: React.FC = () => {
  const router = useRouter();
  const { database, errors } = useAdminStore();
  const { saveData } = useAdminApp();

  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    // Criar notificação temporária
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-md text-white text-sm font-medium shadow-lg ${
      type === 'success' ? 'bg-green-500' :
      type === 'error' ? 'bg-red-500' :
      type === 'warning' ? 'bg-yellow-500' :
      'bg-blue-500'
    }`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remover após 3 segundos
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      await saveData();
      // Feedback visual
      showNotification('Dados salvos com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showNotification('Erro ao salvar dados', 'error');
    }
  }, [saveData, showNotification]);

  const handleExportAll = useCallback(async () => {
    // Verificar se há erros críticos
    const hasCriticalErrors = errors.some(error => error.type === 'ERROR');

    if (hasCriticalErrors) {
      showNotification('Corrija os erros antes de exportar', 'warning');
      router.push('/issues');
      return;
    }

    if (!database) {
      showNotification('Nenhum dado para exportar', 'warning');
      return;
    }

    try {
      await exportAllFilesAsZip(database);
      showNotification('Dados exportados com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      showNotification('Erro ao exportar dados', 'error');
    }
  }, [database, errors, router, showNotification]);

  const focusSearch = useCallback(() => {
    // Tentar encontrar um campo de busca baseado na página atual
    const searchSelectors = [
      'input[placeholder*="buscar" i]',
      'input[placeholder*="search" i]',
      'input[type="search"]',
      'input[name*="search"]',
      'input[id*="search"]',
      '#search-input',
      '.search-input',
    ];

    for (const selector of searchSelectors) {
      const element = document.querySelector(selector) as HTMLInputElement;
      if (element) {
        element.focus();
        element.select();
        return;
      }
    }

    // Se não encontrou campo de busca, mostrar dica
    showNotification('Campo de busca não encontrado nesta página', 'info');
  }, [showNotification]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+S - Forçar save/export do DB
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        handleSave();
        return;
      }

      // Ctrl+Enter - Exportar tudo (se validado)
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        handleExportAll();
        return;
      }

      // / - Focar busca (não funciona em inputs)
      if (event.key === '/' && !(event.target as HTMLElement)?.matches('input, textarea, [contenteditable]')) {
        event.preventDefault();
        focusSearch();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleExportAll, focusSearch]);

  // Este componente não renderiza nada visualmente
  return null;
};