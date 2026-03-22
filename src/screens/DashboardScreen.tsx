'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDaysIcon, UsersIcon, ExclamationTriangleIcon, CloudArrowUpIcon, ClockIcon, GlobeAltIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import ModalLogs from '../components/ui/ModalLogs';
import { useDeployInfo } from '../hooks/useDeployInfo';

export const DashboardScreen: React.FC = () => {
  const router = useRouter();
  const [deployStatus, setDeployStatus] = useState<'running' | 'success' | 'error'>('success');
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [deployLogs, setDeployLogs] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);
  const terminalStatusRef = useRef(false);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const { deployInfo, loading: deployInfoLoading, error: deployInfoError, refetch: refetchDeployInfo } = useDeployInfo();

  const closeStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      closeStream();
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
        refetchTimerRef.current = null;
      }
    };
  }, []);

  const handleDeployFirebase = async () => {
    if (deployStatus === 'running') return;

    closeStream();
    terminalStatusRef.current = false;

    setDeployLogs('');
    setDeployModalOpen(true);
    setDeployStatus('running');

    try {
      console.log('🔄 Iniciando conexão SSE...');
      const eventSource = new EventSource('/api/deploy/firebase/stream');
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        if (!isMountedRef.current) return;
        console.log('📨 SSE message:', event.data);
        const data = event.data;
        setDeployLogs(prev => prev ? prev + '\n' + data : data);
      };

      eventSource.addEventListener('status', (e) => {
        if (!isMountedRef.current) {
          closeStream();
          return;
        }
        const statusData = (e as MessageEvent).data;
        console.log('🎯 SSE status event:', statusData);
        terminalStatusRef.current = true;
        setDeployStatus(statusData === 'success' ? 'success' : 'error');

        if (statusData === 'success') {
          if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
          refetchTimerRef.current = setTimeout(() => {
            refetchTimerRef.current = null;
            if (!isMountedRef.current) return;
            refetchDeployInfo();
          }, 2000);
        }

        closeStream();
      });

      eventSource.addEventListener('close', () => {
        if (!isMountedRef.current) {
          closeStream();
          return;
        }
        console.log('🔌 SSE close event');
        terminalStatusRef.current = true;
        closeStream();
      });

      eventSource.onerror = () => {
        if (terminalStatusRef.current) {
          closeStream();
          return;
        }
        if (!isMountedRef.current) {
          closeStream();
          return;
        }
        console.error('❌ Erro no EventSource');
        setDeployLogs(prev => prev + '\n❌ Erro na conexão de logs em tempo real');
        setDeployStatus('error');
        closeStream();
      };
    } catch (error) {
      console.error('Erro ao iniciar deploy:', error);
      setDeployLogs('❌ Erro ao conectar com o servidor de deploy.');
      setDeployStatus('error');
      eventSourceRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Dashboard Admin BBB26</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Seção de Edição de Dados */}
          <div className="mb-12">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Edição de Dados</h2>
              <p className="text-gray-600">Selecione uma das opções abaixo para editar os dados do BBB26</p>
            </div>

            {/* Botões de edição das telas principais */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <button
                onClick={() => router.push('/bbb26')}
                className="flex flex-col items-center justify-center px-6 py-8 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
              >
                <CalendarDaysIcon className="h-12 w-12 text-indigo-600 mb-4" />
                <span className="text-lg font-semibold">BBB26</span>
                <span className="text-sm text-gray-500 mt-1">Editar dados principais</span>
              </button>

              <button
                onClick={() => router.push('/paredao-results')}
                className="flex flex-col items-center justify-center px-6 py-8 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all"
              >
                <ExclamationTriangleIcon className="h-12 w-12 text-red-600 mb-4" />
                <span className="text-lg font-semibold">Paredão Results</span>
                <span className="text-sm text-gray-500 mt-1">Editar resultados do paredão</span>
              </button>

              <button
                onClick={() => router.push('/participants-status')}
                className="flex flex-col items-center justify-center px-6 py-8 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all"
              >
                <UsersIcon className="h-12 w-12 text-green-600 mb-4" />
                <span className="text-lg font-semibold">Participants Status</span>
                <span className="text-sm text-gray-500 mt-1">Editar status dos participantes</span>
              </button>
            </div>
          </div>

          {/* Seção de Ferramentas e Execução */}
          <div className="mb-12">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Ferramentas e Execução</h2>
              <p className="text-gray-600">Ferramentas automatizadas e publicação de dados</p>
            </div>

            {/* Botões de ferramentas e execução */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <button
                onClick={() => router.push('/queridometro')}
                className="flex flex-col items-center justify-center px-6 py-8 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all"
              >
                <ChartBarIcon className="h-12 w-12 text-purple-600 mb-4" />
                <span className="text-lg font-semibold">Queridômetro</span>
                <span className="text-sm text-gray-500 mt-1">Gerar dados do queridômetro</span>
              </button>

              <button
                onClick={() => router.push('/resumodojogo')}
                className="flex flex-col items-center justify-center px-6 py-8 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all"
              >
                <UsersIcon className="h-12 w-12 text-green-600 mb-4" />
                <span className="text-lg font-semibold">Resumo do Jogo</span>
                <span className="text-sm text-gray-500 mt-1">Atualizar status dos participantes</span>
              </button>

              <button
                onClick={() => router.push('/news')}
                className="flex flex-col items-center justify-center px-6 py-8 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
              >
                <GlobeAltIcon className="h-12 w-12 text-blue-600 mb-4" />
                <span className="text-lg font-semibold">Notícias (gshow)</span>
                <span className="text-sm text-gray-500 mt-1">Buscar notícias do BBB26</span>
              </button>

              <button
                type="button"
                onClick={handleDeployFirebase}
                className="flex flex-col items-center justify-center w-full px-6 py-8 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all"
              >
                <CloudArrowUpIcon className="h-12 w-12 text-orange-600 mb-4" />
                <span className="text-lg font-semibold">Deploy Firebase</span>
                <span className="text-sm text-gray-500 mt-1">Publicar dados no site</span>
                {deployInfo && !deployInfoLoading && !deployInfoError && (
                  <span className="text-xs text-gray-400 mt-2 text-center">
                    Último: {new Date(deployInfo.deployAt).toLocaleString('pt-BR')}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Seção de Informações do Deploy */}
          <div className="mt-12">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Status do Deploy</h3>
              <p className="text-gray-600">Informações da última publicação</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {deployInfoLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                  <span className="ml-3 text-gray-600">Carregando informações...</span>
                </div>
              ) : deployInfoError ? (
                <div className="text-center py-8">
                  <div className="text-red-500 mb-2">❌ Erro ao carregar informações</div>
                  <div className="text-sm text-gray-500">{deployInfoError}</div>
                </div>
              ) : deployInfo ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <ClockIcon className="h-5 w-5 text-green-600 mr-2" />
                      <span className="text-sm font-medium text-gray-700">Último Deploy:</span>
                    </div>
                    <span className="text-sm text-gray-900 font-mono">{deployInfo.lastDeploy}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <CloudArrowUpIcon className="h-5 w-5 text-blue-600 mr-2" />
                      <span className="text-sm font-medium text-gray-700">Versão:</span>
                    </div>
                    <span className="text-sm text-gray-900 font-mono">{deployInfo.version}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <GlobeAltIcon className="h-5 w-5 text-purple-600 mr-2" />
                      <span className="text-sm font-medium text-gray-700">URL:</span>
                    </div>
                    <a
                      href={deployInfo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 underline font-mono"
                    >
                      {deployInfo.url}
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-500">ℹ️ Nenhuma informação de deploy encontrada</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Logs do Deploy */}
      <ModalLogs
        isOpen={deployModalOpen}
        title="Deploy Firebase Hosting (bbb-26)"
        logs={deployLogs}
        status={deployStatus}
        onClose={() => {
          if (deployStatus === 'running') return;
          setDeployModalOpen(false);
        }}
      />
    </div>
  );
};