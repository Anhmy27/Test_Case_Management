import React from 'react';
import type { TestStatus } from '@/lib/tcmTypes';

interface StatusBadgeProps {
  status: TestStatus;
  size?: 'sm' | 'md' | 'lg';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const statusConfig = {
    pass: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      label: 'Pass',
    },
    fail: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      label: 'Fail',
    },
    blocked: {
      bg: 'bg-orange-100',
      text: 'text-orange-800',
      label: 'Blocked',
    },
    untested: {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      label: 'Not Run',
    },
  };

  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${sizeClasses[size]} ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
};

export default StatusBadge;
