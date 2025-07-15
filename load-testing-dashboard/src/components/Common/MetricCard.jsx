import React from 'react';
import { cn } from '../../utils/cn';

const MetricCard = ({ 
  title, 
  value, 
  unit, 
  trend, 
  icon: Icon, 
  color = 'primary',
  loading = false 
}) => {
  const colorClasses = {
    primary: 'text-primary-600 bg-primary-50',
    success: 'text-success-600 bg-success-50',
    warning: 'text-warning-600 bg-warning-50',
    error: 'text-error-600 bg-error-50',
    gray: 'text-gray-600 bg-gray-50'
  };

  const trendClasses = {
    up: 'text-success-600',
    down: 'text-error-600',
    stable: 'text-gray-600'
  };

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-gray-200 rounded loading-shimmer"></div>
            <div className="h-8 bg-gray-200 rounded loading-shimmer"></div>
          </div>
          <div className="h-12 w-12 bg-gray-200 rounded-lg loading-shimmer"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="card hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <div className="flex items-baseline space-x-2">
            <p className="text-2xl font-bold text-gray-900">
              {value}
            </p>
            {unit && (
              <span className="text-sm text-gray-500">{unit}</span>
            )}
          </div>
          {trend && (
            <p className={cn('text-xs mt-1', trendClasses[trend.direction])}>
              {trend.value} {trend.label}
            </p>
          )}
        </div>
        
        {Icon && (
          <div className={cn('p-3 rounded-lg', colorClasses[color])}>
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;