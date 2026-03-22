'use client';

import React, { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface JsonViewerProps {
  data: any;
  title?: string;
  maxHeight?: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({
  data,
  title,
  maxHeight = 300,
  collapsible = true,
  defaultCollapsed = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const formatJson = (obj: any, indent = 0): React.ReactNode => {
    const indentStr = '  '.repeat(indent);

    if (obj === null) {
      return <span className="text-blue-600">null</span>;
    }

    if (typeof obj === 'boolean') {
      return <span className="text-purple-600">{obj.toString()}</span>;
    }

    if (typeof obj === 'number') {
      return <span className="text-orange-600">{obj}</span>;
    }

    if (typeof obj === 'string') {
      return <span className="text-green-600">"{obj}"</span>;
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        return <span className="text-gray-600">{'[]'}</span>;
      }

      return (
        <div>
          <span className="text-gray-600">{'['}</span>
          {obj.map((item, index) => (
            <div key={index} className="ml-4">
              {formatJson(item, indent + 1)}
              {index < obj.length - 1 && <span className="text-gray-400">,</span>}
            </div>
          ))}
          <span className="text-gray-600 ml-[-16px]">{']'}</span>
        </div>
      );
    }

    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      if (keys.length === 0) {
        return <span className="text-gray-600">{'{}'}</span>;
      }

      return (
        <div>
          <span className="text-gray-600">{'{'}</span>
          {keys.map((key, index) => (
            <div key={key} className="ml-4">
              <span className="text-blue-600">"{key}"</span>
              <span className="text-gray-400">: </span>
              {formatJson(obj[key], indent + 1)}
              {index < keys.length - 1 && <span className="text-gray-400">,</span>}
            </div>
          ))}
          <span className="text-gray-600 ml-[-16px]">{'}'}</span>
        </div>
      );
    }

    return <span className="text-gray-600">{String(obj)}</span>;
  };

  if (collapsible && isCollapsed) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg">
        {title && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-100 transition-colors"
          >
            <span className="font-medium text-gray-900">{title}</span>
            <ChevronDownIcon className="h-5 w-5 text-gray-500" />
          </button>
        )}
        <div className="p-4">
          <span className="text-gray-500 italic">JSON collapsed...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg">
      {title && collapsible && (
        <button
          onClick={() => setIsCollapsed(true)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-100 transition-colors"
        >
          <span className="font-medium text-gray-900">{title}</span>
          <ChevronUpIcon className="h-5 w-5 text-gray-500" />
        </button>
      )}
      {!collapsible && title && (
        <div className="p-4 border-b border-gray-200">
          <span className="font-medium text-gray-900">{title}</span>
        </div>
      )}
      <div
        className="p-4 overflow-auto font-mono text-sm"
        style={{ maxHeight }}
      >
        <pre className="whitespace-pre-wrap">
          {formatJson(data)}
        </pre>
      </div>
    </div>
  );
};