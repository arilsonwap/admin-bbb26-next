'use client';

import React, { useState } from 'react';
import {
  PlayIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  ArrowUpRightIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useQueridometro } from '../hooks/useQueridometro';

export const QueridometroManager: React.FC = () => {
  const {
    status,
    lastExecution,
    logs,
    logsExpanded,
    isRunning,
    error,
    runQueridometro,
    clearLogs,
    toggleLogsExpanded
  } = useQueridometro();

  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <ArrowPathIcon className="h-8 w-8 text-blue-600 animate-spin" />;
      case 'success':
        return <CheckCircleIcon className="h-8 w-8 text-green-600" />;
      case 'error':
        return <XCircleIcon className="h-8 w-8 text-red-600" />;
      default:
        return <PlayIcon className="h-8 w-8 text-gray-600" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'running':
        return 'Executando...';
      case 'success':
        return 'Sucesso';
      case 'error':
        return 'Erro';
      default:
        return 'Pronto para executar';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'bg-blue-50 border-blue-200';
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">📊 Queridômetro</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Status Card */}
          <div className={`rounded-lg border p-6 mb-6 ${getStatusColor()}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {getStatusIcon()}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {getStatusText()}
                  </h2>
                  {lastExecution && (
                    <p className="text-sm text-gray-600">
                      Última execução: {new Date(lastExecution.startedAt).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>

              {lastExecution && (
                <div className="text-right">
                  <div className="text-sm text-gray-600">
                    {lastExecution.bytes ? `${(lastExecution.bytes / 1024).toFixed(1)} KB` : 'Tamanho desconhecido'}
                  </div>
                  <a
                    href="/tools/bbb-hosting/public/queridometro.json"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                  >
                    <ArrowUpRightIcon className="h-4 w-4 mr-1" />
                    Ver JSON
                  </a>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="flex justify-center mb-8">
            <button
              onClick={runQueridometro}
              disabled={isRunning}
              className="flex items-center justify-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <PlayIcon className="h-6 w-6 mr-3" />
              {isRunning ? 'Gerando Queridômetro...' : 'Gerar Queridômetro Agora'}
            </button>
          </div>

          {/* Logs Section */}
          {logs.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <DocumentTextIcon className="h-5 w-5 text-gray-500 mr-2" />
                    <h3 className="text-lg font-semibold text-gray-900">Logs da Execução</h3>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={clearLogs}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Limpar
                    </button>
                    <button
                      onClick={toggleLogsExpanded}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      {logsExpanded ? 'Recolher' : 'Expandir'}
                    </button>
                  </div>
                </div>
              </div>

              <div className={`px-6 py-4 ${logsExpanded ? 'block' : 'hidden'}`}>
                <div className="bg-gray-900 rounded-md p-4 max-h-96 overflow-y-auto">
                  <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                    {logs.join('\n')}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Info Section */}
          <div className="mt-8 bg-blue-50 rounded-lg border border-blue-200 p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">ℹ️ Sobre o Queridômetro</h3>
            <div className="text-sm text-blue-800 space-y-2">
              <p>
                Esta ferramenta executa o projeto queridômetro independente localizado em:
                <code className="ml-1 px-2 py-1 bg-blue-100 rounded text-xs font-mono">
                  /home/arilson/PROJETOS/queridometro
                </code>
              </p>
              <p>
                O resultado é automaticamente copiado para <code className="px-2 py-1 bg-blue-100 rounded text-xs font-mono">tools/bbb-hosting/public/queridometro.json</code> e fica disponível para deploy.
              </p>
              <p>
                <strong>Nota:</strong> O projeto queridômetro não é instalado nem modificado pelo painel - apenas executado quando solicitado.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};