import { useState, useCallback } from 'react';
import { AdminDatabase } from '../models/types';

interface VersionInfo {
  id: string;
  timestamp: Date;
  description: string;
  data: AdminDatabase;
  fileType?: 'participants-status' | 'bbb26' | 'paredao-results' | 'full';
}

const VERSION_PREFIX = '@version-';
const MAX_VERSIONS_PER_TYPE = 10;

export const useVersioning = () => {
  const [versions, setVersions] = useState<Map<string, VersionInfo[]>>(new Map());

  // Carregar versões do localStorage
  const loadVersions = useCallback((fileType?: string) => {
    try {
      const loadedVersions: VersionInfo[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(VERSION_PREFIX)) {
          try {
            const versionData = JSON.parse(localStorage.getItem(key)!);
            const version: VersionInfo = {
              id: key,
              timestamp: new Date(versionData.timestamp),
              description: versionData.description,
              data: versionData.data,
              fileType: versionData.fileType,
            };

            if (!fileType || version.fileType === fileType) {
              loadedVersions.push(version);
            }
          } catch (e) {
            // Ignorar versões corrompidas
          }
        }
      }

      // Ordenar por timestamp (mais recente primeiro)
      loadedVersions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Agrupar por tipo
      const versionsByType = new Map<string, VersionInfo[]>();
      loadedVersions.forEach(version => {
        const type = version.fileType || 'full';
        if (!versionsByType.has(type)) {
          versionsByType.set(type, []);
        }
        versionsByType.get(type)!.push(version);
      });

      setVersions(versionsByType);
      return versionsByType;
    } catch (error) {
      console.error('Erro ao carregar versões:', error);
      return new Map();
    }
  }, []);

  // Salvar versão automaticamente
  const saveVersion = useCallback(async (
    data: AdminDatabase,
    description: string,
    fileType: 'participants-status' | 'bbb26' | 'paredao-results' | 'full' = 'full'
  ): Promise<string> => {
    try {
      const versionId = `${VERSION_PREFIX}${fileType}-${Date.now()}`;
      const versionInfo: VersionInfo = {
        id: versionId,
        timestamp: new Date(),
        description,
        data: JSON.parse(JSON.stringify(data)), // Deep clone
        fileType,
      };

      localStorage.setItem(versionId, JSON.stringify({
        timestamp: versionInfo.timestamp.toISOString(),
        description: versionInfo.description,
        data: versionInfo.data,
        fileType: versionInfo.fileType,
      }));

      // Limpar versões antigas do mesmo tipo
      await cleanupOldVersions(fileType);

      // Recarregar versões
      loadVersions();

      return versionId;
    } catch (error) {
      console.error('Erro ao salvar versão:', error);
      throw new Error('Falha ao criar backup da versão');
    }
  }, [loadVersions]);

  // Limpar versões antigas
  const cleanupOldVersions = useCallback(async (fileType: string) => {
    try {
      const versionsOfType: VersionInfo[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${VERSION_PREFIX}${fileType}-`)) {
          try {
            const versionData = JSON.parse(localStorage.getItem(key)!);
            versionsOfType.push({
              id: key,
              timestamp: new Date(versionData.timestamp),
              description: versionData.description,
              data: versionData.data,
              fileType: versionData.fileType,
            });
          } catch (e) {
            // Remover versões corrompidas
            localStorage.removeItem(key);
          }
        }
      }

      // Ordenar por timestamp (mais recente primeiro)
      versionsOfType.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Remover versões antigas
      if (versionsOfType.length > MAX_VERSIONS_PER_TYPE) {
        const versionsToRemove = versionsOfType.slice(MAX_VERSIONS_PER_TYPE);
        versionsToRemove.forEach(version => {
          localStorage.removeItem(version.id);
        });
      }
    } catch (error) {
      console.error('Erro ao limpar versões antigas:', error);
    }
  }, []);

  // Restaurar versão
  const restoreVersion = useCallback(async (versionId: string): Promise<AdminDatabase> => {
    try {
      const versionData = localStorage.getItem(versionId);
      if (!versionData) {
        throw new Error('Versão não encontrada');
      }

      const version = JSON.parse(versionData);
      return version.data as AdminDatabase;
    } catch (error) {
      console.error('Erro ao restaurar versão:', error);
      throw new Error('Falha ao restaurar versão');
    }
  }, []);

  // Obter versões por tipo
  const getVersionsByType = useCallback((fileType: string): VersionInfo[] => {
    return versions.get(fileType) || [];
  }, [versions]);

  // Obter versão mais recente por tipo
  const getLatestVersion = useCallback((fileType: string): VersionInfo | null => {
    const typeVersions = getVersionsByType(fileType);
    return typeVersions.length > 0 ? typeVersions[0] : null;
  }, [getVersionsByType]);

  // Comparar duas versões (diff simples)
  const compareVersions = useCallback((version1: VersionInfo, version2: VersionInfo) => {
    const changes: string[] = [];

    // Comparação simples baseada em JSON stringified
    const json1 = JSON.stringify(version1.data, null, 2);
    const json2 = JSON.stringify(version2.data, null, 2);

    if (json1 !== json2) {
      changes.push('Dados foram modificados entre as versões');
    }

    return changes;
  }, []);

  // Deletar versão
  const deleteVersion = useCallback(async (versionId: string) => {
    try {
      localStorage.removeItem(versionId);
      loadVersions(); // Recarregar
    } catch (error) {
      console.error('Erro ao deletar versão:', error);
      throw new Error('Falha ao deletar versão');
    }
  }, [loadVersions]);

  return {
    versions,
    loadVersions,
    saveVersion,
    restoreVersion,
    getVersionsByType,
    getLatestVersion,
    compareVersions,
    deleteVersion,
  };
};