import { useState, useCallback, useRef, useEffect } from 'react';

interface ResumoDoJogoExecution {
  startedAt: string;
  finishedAt?: string;
  publishedPath?: string;
  sourcePath?: string;
  bytes?: number;
  logTail?: string[];
}

type ResumoDoJogoStatus = 'idle' | 'running' | 'success' | 'error';

export const useResumoDoJogo = () => {
  const [status, setStatus] = useState<ResumoDoJogoStatus>('idle');
  const [lastExecution, setLastExecution] = useState<ResumoDoJogoExecution | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const completedRef = useRef<boolean>(false); // Flag para saber se completou

  // Cleanup do EventSource quando componente desmonta
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const runResumoDoJogo = useCallback(async () => {
    if (status === 'running') return;

    // Fechar EventSource anterior se existir
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Limpar estado completamente antes de iniciar
    setStatus('running');
    setError(null);
    setLogsExpanded(true); // Expandir logs automaticamente
    setLogs([]);
    completedRef.current = false; // Reset da flag
    console.log('🚀 Iniciando resumo do jogo - estado limpo');

    try {
      console.log('🔄 Iniciando conexão SSE do resumo do jogo...');
      const eventSource = new EventSource('/api/run-resumodojogo');
      eventSourceRef.current = eventSource;

      // Listener específico para eventos de status - DEVE vir ANTES do onmessage
      eventSource.addEventListener('status', (e) => {
        const statusData = (e as MessageEvent).data;
        console.log('🎯 SSE resumo do jogo status event received:', statusData);
        setStatus(statusData === 'success' ? 'success' : 'error');
        completedRef.current = true; // Marcar como completado
        console.log('✅ Completed flag set to true');

        // Para compatibilidade, criar um lastExecution básico
        if (statusData === 'success') {
          setLastExecution({
            startedAt: new Date().toISOString(), // Será atualizado pela API se necessário
            finishedAt: new Date().toISOString(),
            publishedPath: `/tools/bbb-hosting/public/statusbbb.json`,
            bytes: 0 // Será atualizado se necessário
          });

          // Adicionar mensagem de confirmação
          setLogs(prev => [...prev,
            `📅 Data: ${new Date().toLocaleString('pt-BR')}`,
            `✅ Arquivo salvo: statusbbb.json`,
            `🔗 Disponível em: /tools/bbb-hosting/public/statusbbb.json`
          ]);
        }

        eventSource.close();
        eventSourceRef.current = null;
      });

      eventSource.onmessage = (event) => {
        console.log('📨 SSE resumo do jogo message:', event.data, 'type:', event.type);

        // Fallback: detectar evento status nas mensagens normais
        if ((event.data === 'success' || event.data === 'error') && !completedRef.current) {
          const statusData = event.data;
          console.log('🎯 Status', statusData, 'detectado via fallback onmessage');
          setStatus(statusData === 'success' ? 'success' : 'error');
          completedRef.current = true;

          if (statusData === 'success') {
            setLastExecution({
              startedAt: new Date().toISOString(),
              finishedAt: new Date().toISOString(),
              publishedPath: `/tools/bbb-hosting/public/statusbbb.json`,
              bytes: 0
            });

            setLogs(prev => [...prev,
              `📅 Data: ${new Date().toLocaleString('pt-BR')}`,
              `✅ Arquivo salvo: statusbbb.json`,
              `🔗 Disponível em: /tools/bbb-hosting/public/statusbbb.json`
            ]);
          }

          eventSource.close();
          eventSourceRef.current = null;
          return;
        }

        // Mensagens normais
        const data = event.data;
        setLogs(prev => {
          const newLogs = [...prev, data];
          console.log('📝 Logs atualizados - total:', newLogs.length, '- última:', data.substring(0, 50) + (data.length > 50 ? '...' : ''));
          return newLogs;
        });
      };

      eventSource.onerror = (event) => {
        const target = event.target as EventSource;
        console.log('🚨 SSE onerror triggered:', {
          completed: completedRef.current,
          readyState: target?.readyState,
          status: status
        });

        // Se já completamos com sucesso, ignorar qualquer erro
        if (completedRef.current) {
          console.log('🔌 SSE connection closed after successful completion - ignoring error');
          eventSource.close();
          eventSourceRef.current = null;
          return;
        }

        // Se já temos um status final (success/error), ignorar qualquer erro
        if (status === 'success' || status === 'error') {
          console.log('🔄 SSE error ignored - execution already completed with status:', status);
          eventSource.close();
          eventSourceRef.current = null;
          return;
        }

        // Para conexões fechadas, dar um tempo antes de declarar erro
        // O evento 'status' pode ainda estar a caminho
        if (target && target.readyState === EventSource.CLOSED) {
          console.log('🔌 SSE connection closed - waiting 5s for status event...');

          // Aguardar 5 segundos para ver se o evento status chega
          setTimeout(() => {
            console.log('⏰ Timeout check (5s):', {
              completed: completedRef.current,
              currentStatus: status
            });
            // Verificar se ainda está rodando e não foi completado
            if (!completedRef.current) {
              console.log('❌ Status event never arrived - declaring connection error');
              setLogs(prev => [...prev, '❌ Conexão perdida - verifique se o resumo do jogo terminou']);
              setStatus('error');
              setError('Conexão perdida');
              eventSource.close();
              eventSourceRef.current = null;
            } else {
              console.log('✅ Status event arrived or execution completed - no error needed');
            }
          }, 5000);
          return;
        }

        // Para outros tipos de erro, declarar imediatamente
        console.error('❌ Erro crítico no EventSource do resumo do jogo:', event);
        setLogs(prev => [...prev, '❌ Erro crítico na conexão de logs em tempo real']);
        setStatus('error');
        setError('Erro crítico na conexão SSE');
        eventSource.close();
        eventSourceRef.current = null;
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setStatus('error');
      setError(errorMessage);
      setLogs(prev => [...prev, `❌ Erro ao iniciar: ${errorMessage}`]);
      eventSourceRef.current = null;
    }
  }, [status]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const toggleLogsExpanded = useCallback(() => {
    setLogsExpanded(prev => !prev);
  }, []);

  return {
    status,
    lastExecution,
    logs,
    logsExpanded,
    isRunning: status === 'running',
    error,
    runResumoDoJogo,
    clearLogs,
    toggleLogsExpanded
  };
};