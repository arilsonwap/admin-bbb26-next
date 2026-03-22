import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  onPress?: () => void;
  variant?: 'default' | 'primary' | 'secondary' | 'warning' | 'error';
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  children,
  icon,
  onPress,
  variant = 'default',
  className = '',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-indigo-50 border-indigo-200';
      case 'secondary':
        return 'bg-gray-50 border-gray-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-white border-gray-200';
    }
  };

  const baseClasses = `
    rounded-lg border shadow-sm p-6
    ${getVariantStyles()}
    ${onPress ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
    ${className}
  `;

  const content = (
    <>
      {(title || icon) && (
        <div className="flex items-start mb-4">
          {icon && <div className="mr-3">{icon}</div>}
          <div className="flex-1">
            {title && (
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-gray-600 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      )}

      {children && (
        <div className="text-gray-700">
          {children}
        </div>
      )}
    </>
  );

  if (onPress) {
    return (
      <button onClick={onPress} className={baseClasses}>
        {content}
      </button>
    );
  }

  return (
    <div className={baseClasses}>
      {content}
    </div>
  );
};