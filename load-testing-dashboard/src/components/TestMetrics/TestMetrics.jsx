import React from 'react';
import { 
  ClockIcon, 
  UserGroupIcon, 
  ExclamationTriangleIcon,
  ChartBarIcon 
} from '@heroicons/react/24/outline';
import MetricCard from '../Common/MetricCard';

const TestMetrics = ({ stats, loading = false }) => {
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Métriques en temps réel
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, index) => (
            <MetricCard key={index} loading={true} />
          ))}
        </div>
      </div>
    );
  }

  if (!stats || !stats.stats) {
    return (
      <div className="card text-center py-12">
        <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Aucune métrique disponible
        </h3>
        <p className="text-gray-500">
          Les métriques apparaîtront une fois le test démarré
        </p>
      </div>
    );
  }

  // Trouver les statistiques agrégées
  const aggregatedStats = stats.stats.find(stat => stat.name === 'Aggregated') || {};
  
  const metrics = [
    {
      title: 'Temps de réponse moyen',
      value: aggregatedStats.avg_response_time ? 
        Math.round(aggregatedStats.avg_response_time) : 0,
      unit: 'ms',
      icon: ClockIcon,
      color: 'primary',
      trend: aggregatedStats.avg_response_time > 1000 ? 
        { direction: 'up', value: 'Élevé', label: '' } : 
        { direction: 'stable', value: 'Normal', label: '' }
    },
    {
      title: 'Requêtes par seconde',
      value: aggregatedStats.current_rps ? 
        Math.round(aggregatedStats.current_rps * 10) / 10 : 0,
      unit: 'req/s',
      icon: ChartBarIcon,
      color: 'success'
    },
    {
      title: 'Utilisateurs actifs',
      value: stats.user_count || 0,
      unit: 'users',
      icon: UserGroupIcon,
      color: 'primary'
    },
    {
      title: 'Taux d\'erreur',
      value: aggregatedStats.num_requests ? 
        Math.round((aggregatedStats.num_failures / aggregatedStats.num_requests) * 100 * 10) / 10 : 0,
      unit: '%',
      icon: ExclamationTriangleIcon,
      color: aggregatedStats.num_failures > 0 ? 'error' : 'success'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Métriques en temps réel
        </h3>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-500">Mise à jour automatique</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <MetricCard
            key={index}
            title={metric.title}
            value={metric.value}
            unit={metric.unit}
            icon={metric.icon}
            color={metric.color}
            trend={metric.trend}
          />
        ))}
      </div>

      {/* Détails supplémentaires */}
      {aggregatedStats.num_requests > 0 && (
        <div className="card">
          <h4 className="text-md font-medium text-gray-900 mb-4">
            Détails des performances
          </h4>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Total requêtes</p>
              <p className="font-semibold text-gray-900">
                {aggregatedStats.num_requests?.toLocaleString() || 0}
              </p>
            </div>
            
            <div>
              <p className="text-gray-500">Échecs</p>
              <p className="font-semibold text-gray-900">
                {aggregatedStats.num_failures?.toLocaleString() || 0}
              </p>
            </div>
            
            <div>
              <p className="text-gray-500">Médiane</p>
              <p className="font-semibold text-gray-900">
                {aggregatedStats.median_response_time || 0} ms
              </p>
            </div>
            
            <div>
              <p className="text-gray-500">95e centile</p>
              <p className="font-semibold text-gray-900">
                {aggregatedStats['95%_response_time'] || 0} ms
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestMetrics;