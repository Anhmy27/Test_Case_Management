import React from 'react';
import type { TestStatus } from '@/lib/tcmTypes';
import StatusBadge from './StatusBadge';

interface ExecutionHistoryProps {
  history: TestStatus[];
  maxDisplay?: number;
}

const ExecutionHistory: React.FC<ExecutionHistoryProps> = ({ history, maxDisplay = 5 }) => {
  const displayHistory = history.slice(-maxDisplay);

  const getStatusIcon = (status: TestStatus) => {
    switch (status) {
      case 'pass':
        return '✅';
      case 'fail':
        return '❌';
      case 'blocked':
        return '🚫';
      case 'untested':
        return '⚪';
      default:
        return '⚪';
    }
  };

  if (displayHistory.length === 0) {
    return <span className="text-gray-400 text-sm">No history</span>;
  }

  return (
    <div className="flex items-center gap-1">
      {displayHistory.map((status, index) => (
        <span
          key={index}
          className="text-lg cursor-pointer"
          title={`Run ${index + 1}: ${status}`}
        >
          {getStatusIcon(status)}
        </span>
      ))}
      {history.length > maxDisplay && (
        <span className="text-gray-400 text-sm ml-1">
          +{history.length - maxDisplay}
        </span>
      )}
    </div>
  );
};

export default ExecutionHistory;
