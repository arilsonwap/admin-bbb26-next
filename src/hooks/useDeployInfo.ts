import { useState, useEffect } from 'react';

interface DeployInfo {
  deployAt: string;
  version: string;
  lastDeploy: string;
  url: string;
}

export const useDeployInfo = () => {
  const [deployInfo, setDeployInfo] = useState<DeployInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeployInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/deploy-info');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar informações do deploy');
      }

      setDeployInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      console.error('Erro ao buscar informações do deploy:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeployInfo();
  }, []);

  return {
    deployInfo,
    loading,
    error,
    refetch: fetchDeployInfo
  };
};