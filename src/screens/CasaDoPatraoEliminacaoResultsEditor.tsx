'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeftIcon,
  DocumentCheckIcon,
  CodeBracketIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { Card } from '../components/common/Card';
import { validateCasaDoPatraoEliminacaoResultsJson } from '../lib/casaDoPatraoEliminacaoResults';

const API = '/api/save-casa-do-patrao-eliminacao-results';
const FILE_LABEL = 'casa-do-patrao-eliminacao-results.json';

const EXAMPLE_PLACEHOLDER = `{
  "version": 1,
  "updatedAt": "",
  "eliminacoes": [
    {
      "id": "eliminacao-1",
      "data": "2026-04-30",
      "titulo": "1ª Eliminação - 30/04/2026",
      "subtitulo": "Porcentagem dos votos para ficar",
      "tipoVotacao": "FICAR",
      "objetivoVotacao": "FICAR",
      "resultadoOficial": "ELIMINACAO",
      "resultados": [
        { "id": "marina", "name": "Marina", "media": 46.59, "status": "SALVA" },
        { "id": "jovan", "name": "Jovan", "media": 31.81, "status": "SALVO" },
        { "id": "marcelo-skova", "name": "Marcelo Skova", "media": 21.6, "status": "ELIMINADO" }
      ]
    }
  ]
}`;

export const CasaDoPatraoEliminacaoResultsEditor: React.FC = () => {
  const router = useRouter();
  const [jsonContent, setJsonContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const loadCurrentContent = async () => {
      try {
        const response = await fetch(API);
        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }
        const text = await response.text();
        if (!text.trim()) {
          throw new Error('Resposta vazia');
        }
        setJsonContent(text);
      } catch (error) {
        console.error('Erro ao carregar arquivo atual:', error);
        setMessage({
          type: 'error',
          text: `Erro ao carregar JSON atual: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        });
      }
    };
    loadCurrentContent();
  }, []);

  const formatJson = () => {
    try {
      const parsed = JSON.parse(jsonContent);
      setJsonContent(JSON.stringify(parsed, null, 2));
      setMessage({ type: 'success', text: 'JSON formatado com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: 'JSON inválido - não foi possível formatar' });
    }
  };

  const handleSave = async () => {
    if (!jsonContent.trim()) {
      setMessage({ type: 'error', text: 'Conteúdo não pode estar vazio' });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonContent);
    } catch {
      setMessage({ type: 'error', text: 'JSON inválido - verifique a sintaxe' });
      return;
    }

    const validationError = validateCasaDoPatraoEliminacaoResultsJson(parsed);
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }

    setIsLoading(true);
    setMessage(null);
    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: jsonContent }),
      });
      if (!response.ok) {
        let detail = `Erro HTTP: ${response.status}`;
        try {
          const body = await response.json();
          if (body && typeof body.error === 'string') {
            detail = body.error;
          } else if (body && typeof body.details === 'string') {
            detail = body.details;
          }
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }
      const result = await response.json();
      if (result.success) {
        try {
          const reload = await fetch(API);
          if (reload.ok) {
            setJsonContent(await reload.text());
          }
        } catch {
          /* mantém o textarea como enviado */
        }
        setMessage({
          type: 'success',
          text: `Arquivos atualizados com sucesso!\n• tools/bbb-hosting/public/${FILE_LABEL}\n• ${FILE_LABEL} (raiz do projeto)\n• tools/bbb-hosting/public/casa-do-patrao-eliminacao-results-latest.json`,
        });
      } else {
        throw new Error(result.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setMessage({
        type: 'error',
        text: `Erro ao salvar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="lg:hidden bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => router.back()}
                className="mr-4 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <h1 className="text-sm font-semibold text-gray-900">{FILE_LABEL}</h1>
            </div>
          </div>
        </div>
      </header>

      <header className="hidden lg:block bg-white/90 backdrop-blur shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">Casa do Patrão — histórico de eliminações</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {FILE_LABEL}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <Card className="bg-blue-50 border-blue-200">
              <div className="flex items-start space-x-3">
                <DocumentCheckIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-medium text-blue-900">Como usar</h3>
                  <div className="mt-2 text-sm text-blue-800">
                    <p>
                      Mesmo padrão conceitual do <code className="bg-blue-100 px-1 rounded">paredao-results.json</code>, com votação{' '}
                      <strong>para ficar</strong> (<code className="bg-blue-100 px-1 rounded">objetivoVotacao</code> e{' '}
                      <code className="bg-blue-100 px-1 rounded">tipoVotacao</code> = <code className="bg-blue-100 px-1 rounded">FICAR</code>): quem tem a{' '}
                      <strong>menor</strong> <code className="bg-blue-100 px-1 rounded">media</code> é o{' '}
                      <code className="bg-blue-100 px-1 rounded">ELIMINADO</code>; os demais usam <code className="bg-blue-100 px-1 rounded">SALVO</code> ou{' '}
                      <code className="bg-blue-100 px-1 rounded">SALVA</code>. Cada rodada é um item em{' '}
                      <code className="bg-blue-100 px-1 rounded">eliminacoes[]</code> (histórico acumulado).
                    </p>
                    <ul className="mt-2 ml-4 list-disc space-y-1">
                      <li>Valida sintaxe e estrutura do arquivo inteiro</li>
                      <li>
                        Ao salvar: preenche <code className="bg-blue-100 px-1 rounded">updatedAt</code>, incrementa <code className="bg-blue-100 px-1 rounded">version</code> com base no arquivo anterior no hosting
                      </li>
                      <li>Salva JSON formatado em <code className="bg-blue-100 px-1 rounded">{FILE_LABEL}</code> (hosting + raiz do projeto)</li>
                      <li>Atualiza <code className="bg-blue-100 px-1 rounded">casa-do-patrao-eliminacao-results-latest.json</code></li>
                    </ul>
                    <p className="mt-3 text-sm">
                      Raiz: <code className="bg-blue-100 px-1 rounded">version</code>, <code className="bg-blue-100 px-1 rounded">updatedAt</code>,{' '}
                      <code className="bg-blue-100 px-1 rounded">eliminacoes[]</code>. Cada eliminação: <code className="bg-blue-100 px-1 rounded">id</code>,{' '}
                      <code className="bg-blue-100 px-1 rounded">data</code>, <code className="bg-blue-100 px-1 rounded">titulo</code>,{' '}
                      <code className="bg-blue-100 px-1 rounded">subtitulo</code>, <code className="bg-blue-100 px-1 rounded">resultadoOficial</code>,{' '}
                      <code className="bg-blue-100 px-1 rounded">resultados[]</code> (<code className="bg-blue-100 px-1 rounded">id</code>,{' '}
                      <code className="bg-blue-100 px-1 rounded">name</code>, <code className="bg-blue-100 px-1 rounded">media</code>,{' '}
                      <code className="bg-blue-100 px-1 rounded">status</code>).
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CodeBracketIcon className="h-5 w-5 text-gray-600" />
                    <h3 className="text-lg font-medium text-gray-900">Conteúdo JSON</h3>
                  </div>
                  <button
                    type="button"
                    onClick={formatJson}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    title="Formatar JSON"
                  >
                    <CodeBracketIcon className="h-4 w-4 mr-2" />
                    Formatar JSON
                  </button>
                </div>

                <textarea
                  value={jsonContent}
                  onChange={e => setJsonContent(e.target.value)}
                  rows={25}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50"
                  placeholder={`Cole aqui o JSON (version, updatedAt, eliminacoes)...\n\nExemplo:\n${EXAMPLE_PLACEHOLDER}`}
                />

                {message && (
                  <div
                    className={`flex items-center space-x-2 p-4 rounded-lg ${
                      message.type === 'success'
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}
                  >
                    {message.type === 'success' ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-red-600" />
                    )}
                    <div className="text-sm whitespace-pre-line">{message.text}</div>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isLoading}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <DocumentCheckIcon className="h-5 w-5 mr-2" />
                        Salvar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};
