import React from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: string;
  showLabel?: boolean;
  label?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  color = '#22c55e',
  height = '8px',
  showLabel = true,
  label,
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-600">{label || 'Progress'}</span>
          <span className="text-sm font-semibold text-gray-900">{percentage.toFixed(1)}%</span>
        </div>
      )}
      <div
        className="w-full bg-gray-200 rounded-full overflow-hidden"
        style={{ height }}
      >
        <div
          className="h-full rounded-full transition-all duration-300 ease-in-out"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
