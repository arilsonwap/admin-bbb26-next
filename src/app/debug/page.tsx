'use client';

import { useEffect, useState } from 'react';
import { debugParticipantImage, getParticipantImage } from '../../utils/avatarUtils';

export default function DebugPage() {
  const [debugInfo, setDebugInfo] = useState<any[]>([]);

  useEffect(() => {
    // Testar alguns nomes conhecidos
    const testNames = [
      'Babu Santana',
      'Sol Vega',
      'Jonas Sulzbach',
      'Sarah Andrade',
      'Alberto Cowboy',
      'Ana Paula Renault'
    ];

    const results = testNames.map(name => ({
      name,
      debug: debugParticipantImage(name),
      imageUrl: getParticipantImage(name)
    }));

    setDebugInfo(results);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Debug Avatares</h1>

      <div className="space-y-4">
        {debugInfo.map((info, index) => (
          <div key={index} className="border rounded-lg p-4">
            <h3 className="font-semibold">{info.name}</h3>
            <div className="mt-2 text-sm text-gray-600">
              <p>Normalized: {info.debug.normalizedKey}</p>
              <p>Has Image: {info.debug.hasImage ? '✅' : '❌'}</p>
              <p>Image URL: {info.debug.imageUrl || 'N/A'}</p>
              <p>Final URL: {info.imageUrl}</p>
            </div>
            <div className="mt-2">
              <img
                src={info.imageUrl}
                alt={info.name}
                className="w-16 h-16 rounded-full border"
                onError={(e) => console.log('Erro na imagem:', info.name)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}