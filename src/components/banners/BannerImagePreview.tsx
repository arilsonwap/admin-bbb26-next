'use client';

import React, { useEffect, useState } from 'react';
import { PhotoIcon } from '@heroicons/react/24/outline';

type Props = {
  imageUrl: string;
  alt?: string;
  className?: string;
};

export function BannerImagePreview({ imageUrl, alt = 'Preview', className = '' }: Props) {
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setErr(false);
    setLoading(true);
  }, [imageUrl]);

  if (!imageUrl.trim()) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-400 ${className}`}
      >
        <PhotoIcon className="h-10 w-10" aria-hidden />
        <span className="mt-2 text-xs">Informe uma URL para pré-visualizar</span>
      </div>
    );
  }

  if (err) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700 ${className}`}
      >
        Não foi possível carregar a imagem. Verifique a URL.
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg border border-gray-200 bg-gray-100 ${className}`}>
      {loading ? (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={alt}
        className="h-full w-full max-h-48 object-contain object-center"
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setErr(true);
        }}
      />
    </div>
  );
}
