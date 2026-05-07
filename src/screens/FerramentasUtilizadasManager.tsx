'use client';

import React from 'react';
import {
  ArrowPathIcon,
  ArrowUpRightIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  PlayIcon,
  WrenchScrewdriverIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useCasaDoPatraoBarra } from '../hooks/useCasaDoPatraoBarra';

export const FerramentasUtilizadasManager: React.FC = () => {
  const {
    status,
    lastExecution,
    logs,
    logsExpanded,
    isRunning,
    error,
    run,
    clearLogs,
    toggleLogsExpanded,
  } = useCasaDoPatraoBarra();

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
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Barra (status)</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">🏠 Casa do Patrão — Barra (status)</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Extrai badges visíveis na barra, como <strong>PATRÃO</strong>, <strong>TÁ NA RETA</strong>,{' '}
                  <strong>TÁ NA RUA</strong> e <strong>PODER DO VOTO</strong>.
                </p>
              </div>
              <WrenchScrewdriverIcon className="h-6 w-6 text-gray-400" aria-hidden />
            </div>

            <div className={`rounded-lg border p-4 mt-5 ${getStatusColor()}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {getStatusIcon()}
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{getStatusText()}</h3>
                    {lastExecution && (
                      <p className="text-sm text-gray-600">
                        Última execução: {new Date(lastExecution.startedAt).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                </div>

                {lastExecution && (
                  <div className="text-right space-y-1">
                    <div className="flex flex-col items-end gap-1">
                      <a
                        href="/api/hosting-public/casa-do-patrao-participantes-barra.json"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                      >
                        <ArrowUpRightIcon className="h-4 w-4 mr-1" />
                        Ver JSON
                      </a>
                      <a
                        href="/api/hosting-public/casa-do-patrao-participantes-barra-latest.json"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                      >
                        <ArrowUpRightIcon className="h-4 w-4 mr-1" />
                        Ver metadados (latest)
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-md">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  if (
                    !confirm(
                      'Executar o scraper da barra (status) da Casa do Patrão? O resultado será publicado em tools/bbb-hosting/public para preview no admin.',
                    )
                  ) {
                    return;
                  }
                  run();
                }}
                disabled={isRunning}
                className="flex items-center justify-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all w-full max-w-md"
              >
                <WrenchScrewdriverIcon className="h-6 w-6 mr-3" />
                {isRunning ? 'Executando...' : 'Executar'}
              </button>
            </div>
          </div>

          {logs.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <DocumentTextIcon className="h-5 w-5 text-gray-500 mr-2" />
                    <h3 className="text-lg font-semibold text-gray-900">Logs da Execução</h3>
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={clearLogs} className="text-sm text-gray-500 hover:text-gray-700">
                      Limpar
                    </button>
                    <button onClick={toggleLogsExpanded} className="text-sm text-gray-500 hover:text-gray-700">
                      {logsExpanded ? 'Recolher' : 'Expandir'}
                    </button>
                  </div>
                </div>
              </div>

              <div className={`px-6 py-4 ${logsExpanded ? 'block' : 'hidden'}`}>
                <div className="bg-gray-900 rounded-md p-4 max-h-96 overflow-y-auto">
                  <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">{logs.join('\n')}</pre>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 bg-blue-50 rounded-lg border border-blue-200 p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">ℹ️ Sobre</h3>
            <div className="text-sm text-blue-800 space-y-2">
              <p>
                Executa{' '}
                <code className="px-2 py-1 bg-blue-100 rounded text-xs font-mono">
                  scripts/extrair-casa-do-patrao-barra.js
                </code>{' '}
                via <code className="px-2 py-1 bg-blue-100 rounded text-xs font-mono">npm run scrape:casa-patrao-barra</code>.
              </p>
              <p>
                Publica em{' '}
                <code className="px-2 py-1 bg-blue-100 rounded text-xs font-mono">
                  tools/bbb-hosting/public/casa-do-patrao-participantes-barra.json
                </code>{' '}
                para preview via{' '}
                <code className="px-2 py-1 bg-blue-100 rounded text-xs font-mono">
                  /api/hosting-public/casa-do-patrao-participantes-barra.json
                </code>
                .
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

