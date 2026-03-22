import { useEffect, useCallback } from 'react';
import { useAdminStore } from '../store/adminStore';
import { importFromLegacyFiles } from '../services/importService';
import { saveAdminDatabase, loadAdminDatabase, hasAdminDatabase } from '../services/storageService';
import { createInitialDatabase } from '../store/adminStore';

export const useAdminApp = () => {
  const {
    database,
    isLoading,
    errors,
    hasUnsavedChanges,
    setDatabase,
    setLoading,
    setErrors,
    setHasUnsavedChanges,
    validateDatabase,
  } = useAdminStore();

  // Carregar dados na inicialização
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const hasExistingDb = await hasAdminDatabase();

      if (hasExistingDb) {
        const loadedDb = await loadAdminDatabase();
        if (loadedDb) {
          setDatabase(loadedDb);
        }
      } else {
        // Tentar importar dos arquivos legados
        try {
          const bbb26Response = await fetch('./tools/bbb-hosting/public/bbb26.json');
          const participantsResponse = await fetch('./tools/bbb-hosting/public/participants-status.json');
          const paredaoResponse = await fetch('./tools/bbb-hosting/public/paredao-results.json');

          if (bbb26Response.ok && participantsResponse.ok && paredaoResponse.ok) {
            const [bbb26Data, participantsData, paredaoData] = await Promise.all([
              bbb26Response.json(),
              participantsResponse.json(),
              paredaoResponse.json(),
            ]);

            const importedDb = await importFromLegacyFiles(
              bbb26Data,
              participantsData,
              paredaoData
            );

            setDatabase(importedDb);
            await saveAdminDatabase(importedDb);
          } else {
            // Criar database vazio
            const initialDb = createInitialDatabase();
            setDatabase(initialDb);
          }
        } catch (importError) {
          console.warn('Erro ao importar dados legados:', importError);
          // Criar database vazio
          const initialDb = createInitialDatabase();
          setDatabase(initialDb);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setErrors([{
        type: 'ERROR',
        section: 'general',
        field: 'loading',
        message: 'Erro ao carregar dados da aplicação',
      }]);
    } finally {
      setLoading(false);
    }
  }, [setDatabase, setLoading, setErrors]);

  // Salvar dados
  const saveData = useCallback(async () => {
    if (!database) return;

    try {
      setLoading(true);
      await saveAdminDatabase(database);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Erro ao salvar dados:', error);
      setErrors([{
        type: 'ERROR',
        section: 'general',
        field: 'saving',
        message: 'Erro ao salvar dados da aplicação',
      }]);
    } finally {
      setLoading(false);
    }
  }, [database, setLoading, setHasUnsavedChanges, setErrors]);

  // Validar dados atuais
  const validateCurrentData = useCallback(() => {
    if (!database) return [];
    return validateDatabase();
  }, [database, validateDatabase]);

  // Resetar dados
  const resetData = useCallback(async () => {
    try {
      setLoading(true);
      const initialDb = createInitialDatabase();
      setDatabase(initialDb);
      await saveAdminDatabase(initialDb);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Erro ao resetar dados:', error);
      setErrors([{
        type: 'ERROR',
        section: 'general',
        field: 'reset',
        message: 'Erro ao resetar dados da aplicação',
      }]);
    } finally {
      setLoading(false);
    }
  }, [setDatabase, setLoading, setHasUnsavedChanges, setErrors]);

  // Efeitos
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-validação quando database muda
  useEffect(() => {
    if (database) {
      const currentErrors = validateDatabase();
      setErrors(currentErrors);
    }
  }, [database, validateDatabase, setErrors]);

  return {
    // Estado
    database,
    isLoading,
    errors,
    hasUnsavedChanges,

    // Ações
    saveData,
    resetData,
    validateCurrentData,
    loadData,

    // Utilitários
    hasCriticalErrors: errors.some(error => error.type === 'ERROR'),
    hasWarnings: errors.some(error => error.type === 'WARNING'),
    errorCount: errors.length,
  };
};