import React, { useState, memo, useMemo, useCallback } from 'react';
import {
  ClockIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import MetricCard from '../Common/MetricCard';
import CanvasLineChart from './components/CanvasLineChart';
import CanvasAreaChart from './components/CanvasAreaChart';

const LocustMetricsCharts = memo(({ historyRef, historyVersion, loading }) => {
  const [visibleCharts, setVisibleCharts] = useState({
    overview: true,
    responseTime: true,
    requestsRate: true,
    errors: true,
    distribution: true,
    users: true
  });

  const toggleChart = (chartId) => {
    setVisibleCharts(prev => ({
      ...prev,
      [chartId]: !prev[chartId]
    }));
  };

  // Dériver latestData depuis historyRef
  const latestData = useMemo(() => historyRef.current.latestData, [historyRef, historyVersion]);

  // Fonction pour nettoyer et valider les données Locust
  const cleanLocustData = useCallback((data) => {
    if (!data || typeof data !== 'object') return null;
    
    // Nettoyer les valeurs NaN, Infinity et négatives
    const cleanValue = (value, defaultValue = 0) => {
      if (value == null || isNaN(value) || !isFinite(value) || value < 0) {
        return defaultValue;
      }
      return Math.max(0, Number(value));
    };

    return {
      ...data,
      avg_response_time: cleanValue(data.avg_response_time),
      median_response_time: cleanValue(data.median_response_time),
      '95%_response_time': cleanValue(data['95%_response_time']),
      min_response_time: cleanValue(data.min_response_time),
      max_response_time: cleanValue(data.max_response_time),
      current_rps: cleanValue(data.current_rps),
      total_rps: cleanValue(data.total_rps),
      num_requests: cleanValue(data.num_requests),
      num_failures: cleanValue(data.num_failures)
    };
  }, []);

  // Mémoriser les métriques actuelles pour éviter les recalculs
  const currentMetrics = useMemo(() => {
    if (!latestData || !latestData.stats) return {};
    const aggregated = latestData.stats.find(stat => stat.name === 'Aggregated') || {};
    return cleanLocustData(aggregated);
  }, [latestData, cleanLocustData]);

  // Utiliser historyRef.current et historyVersion pour mémoriser les données RÉELLES
  const chartData = useMemo(() => {
    const history = historyRef.current;
    
    // Fonction pour filtrer les données aberrantes dans l'historique
    const filterOutliers = (dataArray, key) => {
      if (!dataArray.length) return dataArray;
      
      // Calculer la médiane et l'écart interquartile pour détecter les outliers
      const values = dataArray.map(d => d[key]).filter(v => v != null && isFinite(v));
      if (values.length < 3) return dataArray;
      
      values.sort((a, b) => a - b);
      const q1 = values[Math.floor(values.length * 0.25)];
      const q3 = values[Math.floor(values.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;
      
      return dataArray.filter(d => {
        const value = d[key];
        return value >= lowerBound && value <= upperBound;
      });
    };
    
    return {
      responseTime: filterOutliers(history.responseTime || [], 'avg'),
      requestsRate: filterOutliers(history.requestsRate || [], 'rps'),
      errorRate: filterOutliers(history.errorRate || [], 'errorRate'),
      userCount: history.userCount || [], // Les utilisateurs ne devraient pas avoir d'outliers
      requestsTotal: history.requestsTotal || []
    };
  }, [historyRef, historyVersion]);

  if (loading && !latestData) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, index) => (
            <MetricCard key={index} loading={true} />
          ))}
        </div>
      </div>
    );
  }

  if (!latestData && (!chartData || Object.values(chartData).every(arr => arr.length === 0))) {
    return (
      <div className="card text-center py-12">
        <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Aucune donnée Locust disponible
        </h3>
        <p className="text-gray-500">
          Démarrez un test pour voir les métriques temporelles s'accumuler
        </p>
      </div>
    );
  }

  const ChartContainer = memo(({ title, children, chartId, dataCount = 0 }) => (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-lg font-medium text-gray-900">{title}</h4>
          <p className="text-sm text-gray-500">{dataCount} points de données</p>
        </div>
        <button
          onClick={() => toggleChart(chartId)}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {visibleCharts[chartId] ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
      </div>
      {visibleCharts[chartId] && children}
    </div>
  ));

  return (
    <div className="space-y-6">
      {/* Métriques principales */}
      {visibleCharts.overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Temps de réponse moyen"
            value={currentMetrics.avg_response_time ? Math.round(currentMetrics.avg_response_time) : 0}
            unit="ms"
            icon={ClockIcon}
            color="primary"
          />
          <MetricCard
            title="Requêtes par seconde"
            value={currentMetrics.current_rps ? Math.round(currentMetrics.current_rps * 10) / 10 : 0}
            unit="req/s"
            icon={ChartBarIcon}
            color="success"
          />
          <MetricCard
            title="Utilisateurs actifs"
            value={latestData?.user_count || 0}
            unit="users"
            icon={UserGroupIcon}
            color="primary"
          />
          <MetricCard
            title="Taux d'erreur"
            value={currentMetrics.num_requests ? 
              Math.round((currentMetrics.num_failures / currentMetrics.num_requests) * 100 * 10) / 10 : 0}
            unit="%"
            icon={ExclamationTriangleIcon}
            color={currentMetrics.num_failures > 0 ? 'error' : 'success'}
          />
        </div>
      )}

      {/* Graphique Canvas des temps de réponse */}
      <ChartContainer 
        title="Évolution des Temps de Réponse" 
        chartId="responseTime"
        dataCount={chartData.responseTime.length}
      >
        {chartData.responseTime.length > 0 ? (
          <CanvasLineChart
            data={chartData.responseTime}
            width={1200}
            height={350}
            lines={[
              { dataKey: 'avg', name: 'Moyenne', color: '#3b82f6' },
              { dataKey: 'median', name: 'Médiane', color: '#10b981' },
              { dataKey: 'p95', name: '95e centile', color: '#f59e0b' }
            ]}
            animate={true}
            showPoints={false}
            strokeWidth={2}
            useFixedScale={true}
          />
        ) : (
          <div className="h-[350px] flex items-center justify-center text-gray-500">
            Aucune donnée de temps de réponse disponible
          </div>
        )}
      </ChartContainer>

      {/* Graphique Canvas du taux de requêtes */}
      <ChartContainer 
        title="Évolution du Taux de Requêtes" 
        chartId="requestsRate"
        dataCount={chartData.requestsRate.length}
      >
        {chartData.requestsRate.length > 0 ? (
          <CanvasAreaChart
            data={chartData.requestsRate}
            width={1200}
            height={350}
            areas={[
              { dataKey: 'rps', name: 'RPS Actuel', color: '#3b82f6', stackId: '1' },
              { dataKey: 'totalRps', name: 'RPS Total', color: '#10b981', stackId: '2' }
            ]}
            animate={true}
            stacked={false}
            opacity={0.6}
            strokeWidth={2}
            useFixedScale={true}
          />
        ) : (
          <div className="h-[350px] flex items-center justify-center text-gray-500">
            Aucune donnée de taux de requêtes disponible
          </div>
        )}
      </ChartContainer>

      {/* Graphique Canvas des erreurs */}
      <ChartContainer 
        title="Évolution des Erreurs" 
        chartId="errors"
        dataCount={chartData.errorRate.length}
      >
        {chartData.errorRate.length > 0 ? (
          <CanvasLineChart
            data={chartData.errorRate}
            width={1200}
            height={350}
            lines={[
              { dataKey: 'failures', name: 'Nombre d\'échecs', color: '#ef4444' },
              { dataKey: 'errorRate', name: 'Taux d\'erreur %', color: '#f59e0b' }
            ]}
            animate={true}
            showPoints={true}
            strokeWidth={2}
            useFixedScale={true}
          />
        ) : (
          <div className="h-[350px] flex items-center justify-center text-gray-500">
            Aucune donnée d'erreurs disponible
          </div>
        )}
      </ChartContainer>

      {/* Graphique Canvas du volume total de requêtes */}
      <ChartContainer 
        title="Évolution du Volume de Requêtes" 
        chartId="distribution"
        dataCount={chartData.requestsTotal.length}
      >
        {chartData.requestsTotal.length > 0 ? (
          <CanvasAreaChart
            data={chartData.requestsTotal}
            width={1200}
            height={350}
            areas={[
              { dataKey: 'successes', name: 'Succès', color: '#22c55e', stackId: 'main' },
              { dataKey: 'failures', name: 'Échecs', color: '#ef4444', stackId: 'main' }
            ]}
            animate={true}
            stacked={true}
            opacity={0.7}
            strokeWidth={2}
            useFixedScale={true}
          />
        ) : (
          <div className="h-[350px] flex items-center justify-center text-gray-500">
            Aucune donnée de volume disponible
          </div>
        )}
      </ChartContainer>

      {/* Graphique Canvas des utilisateurs */}
      <ChartContainer 
        title="Évolution des Utilisateurs Actifs" 
        chartId="users"
        dataCount={chartData.userCount.length}
      >
        {chartData.userCount.length > 0 ? (
          <CanvasAreaChart
            data={chartData.userCount}
            width={1200}
            height={350}
            areas={[
              { dataKey: 'users', name: 'Utilisateurs actifs', color: '#3b82f6' }
            ]}
            animate={true}
            stacked={false}
            opacity={0.4}
            strokeWidth={3}
            useFixedScale={true}
          />
        ) : (
          <div className="h-[350px] flex items-center justify-center text-gray-500">
            Aucune donnée d'utilisateurs disponible
          </div>
        )}
      </ChartContainer>

      {/* Détails supplémentaires */}
      {latestData && (
        <div className="card">
          <h4 className="text-md font-medium text-gray-900 mb-4">
            Détails des performances (Temps Réel)
          </h4>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Total requêtes</p>
              <p className="font-semibold text-gray-900">
                {currentMetrics.num_requests?.toLocaleString() || 0}
              </p>
            </div>
            
            <div>
              <p className="text-gray-500">Échecs</p>
              <p className="font-semibold text-gray-900">
                {currentMetrics.num_failures?.toLocaleString() || 0}
              </p>
            </div>
            
            <div>
              <p className="text-gray-500">Médiane</p>
              <p className="font-semibold text-gray-900">
                {currentMetrics.median_response_time || 0} ms
              </p>
            </div>
            
            <div>
              <p className="text-gray-500">95e centile</p>
              <p className="font-semibold text-gray-900">
                {currentMetrics['95%_response_time'] || 0} ms
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{latestData.user_count || 0}</div>
              <div className="text-sm text-blue-800">Utilisateurs actifs</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{latestData.state || 'Arrêté'}</div>
              <div className="text-sm text-green-800">État du test</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {currentMetrics.total_rps ? Math.round(currentMetrics.total_rps * 10) / 10 : 0}
              </div>
              <div className="text-sm text-purple-800">RPS Total</div>
            </div>
          </div>
        </div>
      )}

      {/* Résumé de l'historique */}
      <div className="card">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Résumé de l'Historique Accumulé</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-700">{chartData.responseTime.length}</div>
            <div className="text-xs text-gray-600">Points temps réponse</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-700">{chartData.requestsRate.length}</div>
            <div className="text-xs text-gray-600">Points taux requêtes</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-700">{chartData.userCount.length}</div>
            <div className="text-xs text-gray-600">Points utilisateurs</div>
          </div>
        </div>
      </div>
    </div>
  );
});

LocustMetricsCharts.displayName = 'LocustMetricsCharts';

export default LocustMetricsCharts;