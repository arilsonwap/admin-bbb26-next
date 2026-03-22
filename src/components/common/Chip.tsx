import React from 'react';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { ParticipantStatus } from '../../models/types';

interface ChipProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
  disabled?: boolean;
}

const getStatusVariant = (status: ParticipantStatus): ChipProps['variant'] => {
  switch (status) {
    case 'ATIVO':
      return 'success';
    case 'ELIMINADO':
      return 'error';
    case 'DESCLASSIFICADO':
      return 'warning';
    default:
      return 'default';
  }
};

const getStatusIcon = (status: ParticipantStatus) => {
  switch (status) {
    case 'ATIVO':
      return CheckCircleIcon;
    case 'ELIMINADO':
      return XCircleIcon;
    case 'DESCLASSIFICADO':
      return ExclamationTriangleIcon;
    default:
      return null;
  }
};

interface StatusChipProps {
  status: ParticipantStatus;
  onPress?: () => void;
  disabled?: boolean;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  onPress,
  disabled,
}) => {
  return (
    <Chip
      label={status}
      variant={getStatusVariant(status)}
      onPress={onPress}
      disabled={disabled}
    />
  );
};

export const Chip: React.FC<ChipProps> = ({
  label,
  variant = 'default',
  size = 'medium',
  onPress,
  disabled = false,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          backgroundColor: 'bg-green-100',
          borderColor: 'border-green-200',
          textColor: 'text-green-800',
          iconColor: 'text-green-600',
        };
      case 'warning':
        return {
          backgroundColor: 'bg-yellow-100',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-600',
        };
      case 'error':
        return {
          backgroundColor: 'bg-red-100',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          iconColor: 'text-red-600',
        };
      case 'info':
        return {
          backgroundColor: 'bg-blue-100',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          iconColor: 'text-blue-600',
        };
      default:
        return {
          backgroundColor: 'bg-gray-100',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-600',
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          padding: 'px-2 py-1',
          fontSize: 'text-xs',
          iconSize: 'h-3 w-3',
        };
      case 'large':
        return {
          padding: 'px-4 py-2',
          fontSize: 'text-base',
          iconSize: 'h-5 w-5',
        };
      default: // medium
        return {
          padding: 'px-3 py-1',
          fontSize: 'text-sm',
          iconSize: 'h-4 w-4',
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();
  const iconType = getStatusIcon(label as ParticipantStatus);

  const baseClasses = `
    inline-flex items-center rounded-full border font-medium
    ${variantStyles.backgroundColor}
    ${variantStyles.borderColor}
    ${variantStyles.textColor}
    ${sizeStyles.padding}
    ${sizeStyles.fontSize}
    ${disabled ? 'opacity-50 cursor-not-allowed' : onPress ? 'cursor-pointer hover:opacity-80' : ''}
  `;

  const renderIcon = () => {
    if (!iconType) return null;

    const Icon = iconType;
    return <Icon className={`${sizeStyles.iconSize} ${variantStyles.iconColor} mr-1`} />;
  };

  const content = (
    <span className={baseClasses}>
      {renderIcon()}
      {label}
    </span>
  );

  if (onPress && !disabled) {
    return (
      <button onClick={onPress} className="inline-block">
        {content}
      </button>
    );
  }

  return content;
};