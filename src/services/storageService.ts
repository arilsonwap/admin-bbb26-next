import { AdminDatabase } from '../models/types';

const ADMIN_DB_KEY = '@admin-db';
const BACKUP_PREFIX = '@admin-db-backup-';
const LAST_EXPORT_KEY = '@last-export-timestamp';
const MAX_BACKUPS = 20; // Manter apenas os 20 backups mais recentes

// Salvar database principal
export const saveAdminDatabase = async (database: AdminDatabase): Promise<void> => {
  try {
    if (typeof window === 'undefined') return; // Server-side guard

    const data = JSON.stringify(database);
    localStorage.setItem(ADMIN_DB_KEY, data);
  } catch (error) {
    console.error('Erro ao salvar database:', error);
    throw new Error('Falha ao salvar dados');
  }
};

// Carregar database principal
export const loadAdminDatabase = async (): Promise<AdminDatabase | null> => {
  try {
    if (typeof window === 'undefined') return null; // Server-side guard

    const data = localStorage.getItem(ADMIN_DB_KEY);
    if (!data) return null;

    return JSON.parse(data) as AdminDatabase;
  } catch (error) {
    console.error('Erro ao carregar database:', error);
    return null;
  }
};

// Verificar se existe database salvo
export const hasAdminDatabase = async (): Promise<boolean> => {
  try {
    if (typeof window === 'undefined') return false;

    const data = localStorage.getItem(ADMIN_DB_KEY);
    return data !== null;
  } catch {
    return false;
  }
};

// Criar backup automático
export const createBackup = async (database: AdminDatabase): Promise<string> => {
  try {
    if (typeof window === 'undefined') return '';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupKey = `${BACKUP_PREFIX}${timestamp}`;

    const data = JSON.stringify(database);
    localStorage.setItem(backupKey, data);

    // Limpar backups antigos automaticamente
    await cleanupOldBackups();

    return backupKey;
  } catch (error) {
    console.error('Erro ao criar backup:', error);
    throw new Error('Falha ao criar backup');
  }
};

// Limpar backups antigos (manter apenas os mais recentes)
export const cleanupOldBackups = async (): Promise<void> => {
  try {
    if (typeof window === 'undefined') return;

    const keys = Object.keys(localStorage).filter(key =>
      key.startsWith(BACKUP_PREFIX)
    );

    if (keys.length > MAX_BACKUPS) {
      // Ordenar por timestamp (mais recentes primeiro)
      const sortedKeys = keys.sort((a, b) => {
        const timestampA = a.replace(BACKUP_PREFIX, '');
        const timestampB = b.replace(BACKUP_PREFIX, '');
        return timestampB.localeCompare(timestampA);
      });

      // Remover os mais antigos
      const keysToRemove = sortedKeys.slice(MAX_BACKUPS);
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
  } catch (error) {
    console.warn('Erro ao limpar backups antigos:', error);
  }
};

// Carregar backup específico
export const loadBackup = async (backupKey: string): Promise<AdminDatabase | null> => {
  try {
    if (typeof window === 'undefined') return null;

    const data = localStorage.getItem(backupKey);
    if (!data) return null;

    return JSON.parse(data) as AdminDatabase;
  } catch (error) {
    console.error('Erro ao carregar backup:', error);
    return null;
  }
};

// Obter preview de um backup (estatísticas sem carregar tudo)
export const getBackupPreview = async (backupKey: string): Promise<{
  exists: boolean;
  timestamp: Date | null;
  size: number;
  version: number;
  participantsCount: number;
  paredoesCount: number;
} | null> => {
  try {
    if (typeof window === 'undefined') return null;

    const data = localStorage.getItem(backupKey);
    if (!data) return { exists: false, timestamp: null, size: 0, version: 0, participantsCount: 0, paredoesCount: 0 };

    const parsed = JSON.parse(data) as AdminDatabase;
    const timestampStr = backupKey.replace(BACKUP_PREFIX, '').replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z/, '$1-$2-$3T$4:$5:$6.$7Z');

    return {
      exists: true,
      timestamp: new Date(timestampStr),
      size: new Blob([data]).size,
      version: parsed.version,
      participantsCount: Object.keys(parsed.participants).length,
      paredoesCount: parsed.history.paredoes.length,
    };
  } catch (error) {
    console.error('Erro ao obter preview do backup:', error);
    return null;
  }
};

// Listar backups com previews
export const listBackupsWithPreview = async (): Promise<Array<{
  key: string;
  timestamp: Date;
  size: number;
  version: number;
  participantsCount: number;
  paredoesCount: number;
}>> => {
  try {
    if (typeof window === 'undefined') return [];

    const keys = Object.keys(localStorage).filter(key =>
      key.startsWith(BACKUP_PREFIX)
    );

    const backups = await Promise.all(
      keys.map(async (key) => {
        const preview = await getBackupPreview(key);
        if (!preview || !preview.timestamp) return null;

        return {
          key,
          timestamp: preview.timestamp,
          size: preview.size,
          version: preview.version,
          participantsCount: preview.participantsCount,
          paredoesCount: preview.paredoesCount,
        };
      })
    );

    return backups
      .filter(backup => backup !== null)
      .sort((a, b) => b!.timestamp.getTime() - a!.timestamp.getTime());
  } catch (error) {
    console.error('Erro ao listar backups com preview:', error);
    return [];
  }
};

// Restaurar de backup
export const restoreFromBackup = async (backupKey: string): Promise<AdminDatabase> => {
  const backup = await loadBackup(backupKey);
  if (!backup) {
    throw new Error('Backup não encontrado');
  }

  // Salvar como database atual
  await saveAdminDatabase(backup);

  return backup;
};

// Limpar todos os dados (reset)
export const clearAllData = async (): Promise<void> => {
  try {
    if (typeof window === 'undefined') return;

    const keys = Object.keys(localStorage).filter(key =>
      key.startsWith(ADMIN_DB_KEY) ||
      key.startsWith(BACKUP_PREFIX) ||
      key === LAST_EXPORT_KEY
    );

    keys.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error('Erro ao limpar dados:', error);
    throw new Error('Falha ao limpar dados');
  }
};

// Salvar timestamp da última exportação
export const saveLastExportTimestamp = async (): Promise<void> => {
  try {
    if (typeof window === 'undefined') return;

    const timestamp = new Date().toISOString();
    localStorage.setItem(LAST_EXPORT_KEY, timestamp);
  } catch (error) {
    console.error('Erro ao salvar timestamp da exportação:', error);
  }
};

// Carregar timestamp da última exportação
export const loadLastExportTimestamp = async (): Promise<Date | null> => {
  try {
    if (typeof window === 'undefined') return null;

    const timestamp = localStorage.getItem(LAST_EXPORT_KEY);
    return timestamp ? new Date(timestamp) : null;
  } catch (error) {
    console.error('Erro ao carregar timestamp da exportação:', error);
    return null;
  }
};

// Estatísticas de armazenamento
export const getStorageStats = async () => {
  try {
    if (typeof window === 'undefined') return null;

    const keys = Object.keys(localStorage).filter(key =>
      key.startsWith(ADMIN_DB_KEY) ||
      key.startsWith(BACKUP_PREFIX) ||
      key === LAST_EXPORT_KEY
    );

    let totalSize = 0;
    const stats: Record<string, number> = {};

    keys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        const size = new Blob([value]).size;
        stats[key] = size;
        totalSize += size;
      }
    });

    return {
      totalKeys: keys.length,
      totalSize,
      formattedSize: formatBytes(totalSize),
      keys: stats,
    };
  } catch (error) {
    console.error('Erro ao calcular estatísticas:', error);
    return null;
  }
};

// ========== NOVAS FUNÇÕES PARA BACKUPS MELHORADOS ==========

// Download de backup específico
export const downloadBackup = async (backupKey: string): Promise<void> => {
  try {
    if (typeof window === 'undefined') return;

    const backup = await loadBackup(backupKey);
    if (!backup) {
      throw new Error('Backup não encontrado');
    }

    // Extrair timestamp do backupKey
    const timestampStr = backupKey.replace(BACKUP_PREFIX, '').replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z/, '$1-$2-$3_$4-$5-$6');
    const filename = `admin-db-backup-${timestampStr}.json`;

    // Usar a função de download do exportService
    const { downloadFile, formatJSON } = await import('../services/exportService');
    downloadFile(filename, formatJSON(backup));
  } catch (error) {
    console.error('Erro ao fazer download do backup:', error);
    throw new Error('Falha ao fazer download do backup');
  }
};

// Exportar todos os backups como arquivo ZIP (simulado)
export const exportAllBackups = async (): Promise<void> => {
  try {
    if (typeof window === 'undefined') return;

    const backups = await listBackupsWithPreview();
    if (backups.length === 0) {
      throw new Error('Nenhum backup encontrado');
    }

    // Para cada backup, fazer download individual com delay
    const { downloadFile, formatJSON } = await import('../services/exportService');

    backups.forEach((backup, index) => {
      setTimeout(async () => {
        try {
          const backupData = await loadBackup(backup.key);
          if (backupData) {
            const timestampStr = backup.timestamp.toISOString().slice(0, 19).replace(/[:]/g, '-');
            const filename = `backup-${timestampStr}.json`;
            downloadFile(filename, formatJSON(backupData));
          }
        } catch (error) {
          console.error(`Erro ao exportar backup ${backup.key}:`, error);
        }
      }, index * 1000); // 1 segundo de delay entre downloads
    });
  } catch (error) {
    console.error('Erro ao exportar todos os backups:', error);
    throw new Error('Falha ao exportar backups');
  }
};

// Criar backup manual (além do automático)
export const createManualBackup = async (database: AdminDatabase, description?: string): Promise<string> => {
  try {
    if (typeof window === 'undefined') return '';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const manualPrefix = '@admin-db-manual-';
    const backupKey = `${manualPrefix}${timestamp}`;

    const backupData = {
      ...database,
      backupType: 'manual' as const,
      description: description || 'Backup manual',
      createdAt: new Date().toISOString(),
    };

    const data = JSON.stringify(backupData);
    localStorage.setItem(backupKey, data);

    // Limpar backups antigos automaticamente
    await cleanupOldBackups();

    return backupKey;
  } catch (error) {
    console.error('Erro ao criar backup manual:', error);
    throw new Error('Falha ao criar backup manual');
  }
};

// Listar backups manuais separadamente
export const listManualBackups = async (): Promise<Array<{
  key: string;
  timestamp: Date;
  description: string;
  size: number;
}>> => {
  try {
    if (typeof window === 'undefined') return [];

    const manualPrefix = '@admin-db-manual-';
    const keys = Object.keys(localStorage).filter(key =>
      key.startsWith(manualPrefix)
    );

    const backups = await Promise.all(
      keys.map(async (key) => {
        try {
          const data = localStorage.getItem(key);
          if (!data) return null;

          const parsed = JSON.parse(data) as AdminDatabase & {
            backupType?: string;
            description?: string;
            createdAt?: string;
          };

          const timestamp = parsed.createdAt ? new Date(parsed.createdAt) : new Date();

          return {
            key,
            timestamp,
            description: parsed.description || 'Backup manual',
            size: new Blob([data]).size,
          };
        } catch {
          return null;
        }
      })
    );

    return backups
      .filter(backup => backup !== null)
      .sort((a, b) => b!.timestamp.getTime() - a!.timestamp.getTime());
  } catch (error) {
    console.error('Erro ao listar backups manuais:', error);
    return [];
  }
};

// Utilitário para formatar bytes
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};