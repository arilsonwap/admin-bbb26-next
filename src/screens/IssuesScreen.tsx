'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Card } from '../components/common/Card';

export const IssuesScreen: React.FC = () => {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Desktop Only */}
      <header className="hidden lg:block bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">Problemas Detectados</h1>
          </div>
        </div>
      </header>

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
              <h1 className="text-xl font-semibold text-gray-900">Problemas Detectados</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <Card
            title="Sem problemas detectados"
            subtitle="Todos os dados estão consistentes"
            icon={<ExclamationTriangleIcon className="h-6 w-6 text-green-600" />}
            className="max-w-md mx-auto text-center"
          >
            <p className="text-gray-600 mt-4">
              Aqui serão exibidos erros de validação e avisos sobre
              inconsistências nos dados.
            </p>
          </Card>
        </div>
      </main>
    </div>
  );
};