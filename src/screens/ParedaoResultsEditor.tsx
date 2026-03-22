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

export const ParedaoResultsEditor: React.FC = () => {
  const router = useRouter();
  const [jsonContent, setJsonContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Carregar conteúdo atual do arquivo
  useEffect(() => {
    const loadCurrentContent = async () => {
      try {
        const response = await fetch('/tools/bbb-hosting/public/paredao-results.json');
        if (response.ok) {
          const text = await response.text();
          setJsonContent(text);
        }
      } catch (error) {
        console.error('Erro ao carregar arquivo atual:', error);
      }
    };

    loadCurrentContent();
  }, []);

  // Função para formatar JSON
  const formatJson = () => {
    try {
      const parsed = JSON.parse(jsonContent);
      const formatted = JSON.stringify(parsed, null, 2);
      setJsonContent(formatted);
      setMessage({ type: 'success', text: 'JSON formatado com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'JSON inválido - não foi possível formatar' });
    }
  };

  // Função para salvar
  const handleSave = async () => {
    if (!jsonContent.trim()) {
      setMessage({ type: 'error', text: 'Conteúdo não pode estar vazio' });
      return;
    }

    try {
      // Validar JSON
      JSON.parse(jsonContent);
    } catch (error) {
      setMessage({ type: 'error', text: 'JSON inválido - verifique a sintaxe' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/save-paredao-results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: jsonContent }),
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setMessage({
          type: 'success',
          text: `Arquivos atualizados com sucesso!\n• tools/bbb-hosting/public/paredao-results.json\n• tools/bbb-hosting/public/paredao-results-latest.json`
        });
      } else {
        throw new Error(result.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setMessage({
        type: 'error',
        text: `Erro ao salvar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Mobile Only */}
      <header className="lg:hidden bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="mr-4 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <h1 className="text-sm font-semibold text-gray-900">paredao-results.json</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Header - Desktop Only */}
      <header className="hidden lg:block bg-white/90 backdrop-blur shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">Editor de Resultados do Paredão</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                paredao-results.json
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            {/* Instruções */}
            <Card className="bg-blue-50 border-blue-200">
              <div className="flex items-start space-x-3">
                <DocumentCheckIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-medium text-blue-900">Como usar</h3>
                  <div className="mt-2 text-sm text-blue-800">
                    <p>Cole o JSON completo dos resultados do Paredão na caixa abaixo. O sistema irá:</p>
                    <ul className="mt-2 ml-4 list-disc space-y-1">
                      <li>Validar se o JSON é válido</li>
                      <li>Salvar formatado no arquivo <code className="bg-blue-100 px-1 rounded">paredao-results.json</code></li>
                      <li>Gerar automaticamente o arquivo <code className="bg-blue-100 px-1 rounded">paredao-results-latest.json</code> com metadados</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>

            {/* Editor */}
            <Card>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CodeBracketIcon className="h-5 w-5 text-gray-600" />
                    <h3 className="text-lg font-medium text-gray-900">Conteúdo JSON</h3>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={formatJson}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                      title="Formatar JSON"
                    >
                      <CodeBracketIcon className="h-4 w-4 mr-2" />
                      Formatar JSON
                    </button>
                  </div>
                </div>

                <textarea
                  value={jsonContent}
                  onChange={(e) => setJsonContent(e.target.value)}
                  rows={25}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50"
                  placeholder={`Cole aqui o JSON completo dos resultados do Paredão...

Exemplo:
{
  "version": 11,
  "updatedAt": "2026-03-08T00:00:00.000Z",
  "paredoes": [
    {
      "id": "paredao-1",
      "data": "2026-01-20",
      "titulo": "1º Paredão - 20/01/2026",
      "resultados": [
        { "id": "aline-campos", "name": "Aline Campos", "media": 61.64, "status": "ELIMINADO" },
        { "id": "milena", "name": "Milena", "media": 32.5, "status": "SALVO" }
      ]
    }
  ]
}`}
                />

                {/* Mensagem de feedback */}
                {message && (
                  <div className={`flex items-center space-x-2 p-4 rounded-lg ${
                    message.type === 'success'
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    {message.type === 'success' ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-red-600" />
                    )}
                    <div className="text-sm whitespace-pre-line">
                      {message.text}
                    </div>
                  </div>
                )}

                {/* Botão salvar */}
                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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