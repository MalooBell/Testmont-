import React, { useState, memo, useMemo } from 'react';
import {
  CpuChipIcon,
  CircleStackIcon,
  ServerIcon,
  WifiIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import MetricCard from '../Common/MetricCard';
import CanvasLineChart from './components/CanvasLineChart';
import CanvasAreaChart from './components/CanvasAreaChart';

const NodeExporterCharts = memo(({ historyRef, historyVersion, loading }) => {
  const [visibleCharts, setVisibleCharts] = useState({
    overview: true,
    cpu: true,
    memory: true,
    disk: true,
    network: true,
    load: true
  });

  const toggleChart = (chartId) => {
    setVisibleCharts(prev => ({
      ...prev,
      [chartId]: !prev[chartId]
    }));
  };

  // Dériver latestData depuis historyRef
  const latestData = useMemo(() => historyRef.current.latestData, [historyRef, historyVersion]);

  // Fonction utilitaire pour traiter les métriques Prometheus
  const processMetricData = useMemo(() => (metricData) => {
    if (!metricData || !metricData.data || !metricData.data.result) return [];
    return metricData.data.result;
  }, []);

  // Mémoriser les métriques actuelles pour éviter les recalculs
  const currentMetrics = useMemo(() => {
    if (!latestData) return {};

    const cpuData = processMetricData(latestData['rate(node_cpu_seconds_total[5m])']);
    const memoryTotal = processMetricData(latestData['node_memory_MemTotal_bytes']);
    const memoryAvailable = processMetricData(latestData['node_memory_MemAvailable_bytes']);
    const diskSize = processMetricData(latestData['node_filesystem_size_bytes']);
    const diskAvail = processMetricData(latestData['node_filesystem_avail_bytes']);
    const load1 = processMetricData(latestData['node_load1']);
    const load5 = processMetricData(latestData['node_load5']);
    const load15 = processMetricData(latestData['node_load15']);
    const networkRx = processMetricData(latestData['node_network_receive_bytes_total']);
    const networkTx = processMetricData(latestData['node_network_transmit_bytes_total']);

    const calculateCpuUsage = () => {
      if (!cpuData.length) return 0;
      const totalUsage = cpuData.reduce((sum, cpu) => {
        const value = parseFloat(cpu.value[1]);
        return sum + (isNaN(value) ? 0 : value * 100);
      }, 0);
      return Math.round(totalUsage / cpuData.length);
    };

    const calculateMemoryUsage = () => {
      if (!memoryTotal.length || !memoryAvailable.length) return { used: 0, total: 0, percentage: 0 };
      const total = parseFloat(memoryTotal[0].value[1]);
      const available = parseFloat(memoryAvailable[0].value[1]);
      const used = total - available;
      const percentage = Math.round((used / total) * 100);
      return { 
        used: Math.round(used / 1024 / 1024 / 1024), 
        total: Math.round(total / 1024 / 1024 / 1024), 
        percentage 
      };
    };

    const calculateDiskUsage = () => {
      if (!diskSize.length || !diskAvail.length) return { percentage: 0, used: 0, total: 0 };
      const size = parseFloat(diskSize[0].value[1]);
      const avail = diskAvail[0] ? parseFloat(diskAvail[0].value[1]) : 0;
      const used = size - avail;
      const percentage = size > 0 ? Math.round((used / size) * 100) : 0;
      return {
        used: Math.round(used / 1024 / 1024 / 1024),
        total: Math.round(size / 1024 / 1024 / 1024),
        percentage
      };
    };

    const calculateNetworkUsage = () => {
      if (!networkRx.length || !networkTx.length) return { rx: 0, tx: 0 };
      const rx = Math.round(parseFloat(networkRx[0].value[1]) / 1024 / 1024);
      const tx = Math.round(parseFloat(networkTx[0].value[1]) / 1024 / 1024);
      return { rx, tx };
    };

    return {
      cpuUsage: calculateCpuUsage(),
      memoryUsage: calculateMemoryUsage(),
      diskUsage: calculateDiskUsage(),
      networkUsage: calculateNetworkUsage(),
      load1: load1.length ? parseFloat(load1[0].value[1]).toFixed(2) : 0,
      load5: load5.length ? parseFloat(load5[0].value[1]).toFixed(2) : 0,
      load15: load15.length ? parseFloat(load15[0].value[1]).toFixed(2) : 0,
      networkCount: networkRx.filter(net => net.metric.device !== 'lo').length
    };
  }, [latestData, processMetricData]);

  // Utiliser historyRef.current et historyVersion pour mémoriser les données
  const chartData = useMemo(() => {
    const history = historyRef.current;
    return {
      cpu: history.cpu || [],
      memory: history.memory || [],
      disk: history.disk || [],
      network: history.network || [],
      load: history.load || []
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
        <ServerIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Aucune donnée système disponible
        </h3>
        <p className="text-gray-500">
          Vérifiez que Node Exporter est démarré pour voir les métriques temporelles s'accumuler
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
            title="Utilisation CPU"
            value={currentMetrics.cpuUsage || 0}
            unit="%"
            icon={CpuChipIcon}
            color={currentMetrics.cpuUsage > 80 ? 'error' : currentMetrics.cpuUsage > 60 ? 'warning' : 'success'}
          />
          <MetricCard
            title="Mémoire utilisée"
            value={currentMetrics.memoryUsage?.percentage || 0}
            unit="%"
            icon={CircleStackIcon}
            color={currentMetrics.memoryUsage?.percentage > 80 ? 'error' : currentMetrics.memoryUsage?.percentage > 60 ? 'warning' : 'success'}
          />
          <MetricCard
            title="Disque utilisé"
            value={currentMetrics.diskUsage?.percentage || 0}
            unit="%"
            icon={ServerIcon}
            color={currentMetrics.diskUsage?.percentage > 80 ? 'error' : currentMetrics.diskUsage?.percentage > 60 ? 'warning' : 'success'}
          />
          <MetricCard
            title="Load Average (1m)"
            value={currentMetrics.load1 || 0}
            unit=""
            icon={WifiIcon}
            color="primary"
          />
        </div>
      )}

      {/* Graphique Canvas CPU */}
      <ChartContainer 
        title="Évolution de l'Utilisation CPU" 
        chartId="cpu"
        dataCount={chartData.cpu.length}
      >
        {chartData.cpu.length > 0 ? (
          <CanvasLineChart
            data={chartData.cpu}
            width={800}
            height={300}
            lines={[
              { dataKey: 'usage', name: 'Utilisation CPU %', color: '#3b82f6' }
            ]}
            animate={true}
            showPoints={false}
            strokeWidth={2}
          />
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            Aucune donnée CPU disponible
          </div>
        )}
      </ChartContainer>

      {/* Graphique Canvas mémoire */}
      <ChartContainer 
        title="Évolution de l'Utilisation Mémoire" 
        chartId="memory"
        dataCount={chartData.memory.length}
      >
        {chartData.memory.length > 0 ? (
          <CanvasAreaChart
            data={chartData.memory}
            width={800}
            height={300}
            areas={[
              { dataKey: 'used', name: 'Utilisée (GB)', color: '#ef4444', stackId: 'memory' },
              { dataKey: 'available', name: 'Disponible (GB)', color: '#22c55e', stackId: 'memory' }
            ]}
            animate={true}
            stacked={true}
            opacity={0.6}
            strokeWidth={2}
          />
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            Aucune donnée mémoire disponible
          </div>
        )}
      </ChartContainer>

      {/* Graphique Canvas disque */}
      <ChartContainer 
        title="Évolution de l'Utilisation Disque" 
        chartId="disk"
        dataCount={chartData.disk.length}
      >
        {chartData.disk.length > 0 ? (
          <CanvasAreaChart
            data={chartData.disk}
            width={800}
            height={300}
            areas={[
              { dataKey: 'used', name: 'Utilisé (GB)', color: '#ef4444', stackId: 'disk' },
              { dataKey: 'available', name: 'Disponible (GB)', color: '#22c55e', stackId: 'disk' }
            ]}
            animate={true}
            stacked={true}
            opacity={0.6}
            strokeWidth={2}
          />
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            Aucune donnée disque disponible
          </div>
        )}
      </ChartContainer>

      {/* Graphique Canvas réseau */}
      <ChartContainer 
        title="Évolution du Trafic Réseau" 
        chartId="network"
        dataCount={chartData.network.length}
      >
        {chartData.network.length > 0 ? (
          <CanvasAreaChart
            data={chartData.network}
            width={800}
            height={300}
            areas={[
              { dataKey: 'rx', name: 'Reçu (MB)', color: '#3b82f6', stackId: 'network' },
              { dataKey: 'tx', name: 'Envoyé (MB)', color: '#10b981', stackId: 'network' }
            ]}
            animate={true}
            stacked={true}
            opacity={0.6}
            strokeWidth={2}
          />
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            Aucune donnée réseau disponible
          </div>
        )}
      </ChartContainer>

      {/* Graphique Canvas load average */}
      <ChartContainer 
        title="Évolution du Load Average" 
        chartId="load"
        dataCount={chartData.load.length}
      >
        {chartData.load.length > 0 ? (
          <CanvasLineChart
            data={chartData.load}
            width={800}
            height={300}
            lines={[
              { dataKey: 'load1', name: '1 minute', color: '#ef4444' },
              { dataKey: 'load5', name: '5 minutes', color: '#f59e0b' },
              { dataKey: 'load15', name: '15 minutes', color: '#10b981' }
            ]}
            animate={true}
            showPoints={false}
            strokeWidth={2}
          />
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            Aucune donnée de load average disponible
          </div>
        )}
      </ChartContainer>

      {/* Détails système en temps réel */}
      {latestData && (
        <div className="card">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Informations Système (Temps Réel)</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h5 className="font-medium text-gray-700 mb-2">CPU & Load</h5>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Utilisation moyenne:</span>
                  <span className="font-medium">{currentMetrics.cpuUsage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Load 1m:</span>
                  <span className="font-medium">{currentMetrics.load1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Load 5m:</span>
                  <span className="font-medium">{currentMetrics.load5}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Load 15m:</span>
                  <span className="font-medium">{currentMetrics.load15}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h5 className="font-medium text-gray-700 mb-2">Mémoire</h5>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total:</span>
                  <span className="font-medium">{currentMetrics.memoryUsage?.total || 0} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Utilisée:</span>
                  <span className="font-medium">{currentMetrics.memoryUsage?.used || 0} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Disponible:</span>
                  <span className="font-medium">{(currentMetrics.memoryUsage?.total || 0) - (currentMetrics.memoryUsage?.used || 0)} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Pourcentage:</span>
                  <span className="font-medium">{currentMetrics.memoryUsage?.percentage || 0}%</span>
                </div>
              </div>
            </div>
            
            <div>
              <h5 className="font-medium text-gray-700 mb-2">Stockage & Réseau</h5>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Disque utilisé:</span>
                  <span className="font-medium">{currentMetrics.diskUsage?.percentage || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Espace total:</span>
                  <span className="font-medium">{currentMetrics.diskUsage?.total || 0} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Interfaces réseau:</span>
                  <span className="font-medium">{currentMetrics.networkCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Trafic RX:</span>
                  <span className="font-medium">{currentMetrics.networkUsage?.rx || 0} MB</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Résumé de l'historique */}
      <div className="card">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Résumé de l'Historique Accumulé</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-700">{chartData.cpu.length}</div>
            <div className="text-xs text-gray-600">Points CPU</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-700">{chartData.memory.length}</div>
            <div className="text-xs text-gray-600">Points mémoire</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-700">{chartData.disk.length}</div>
            <div className="text-xs text-gray-600">Points disque</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-700">{chartData.network.length}</div>
            <div className="text-xs text-gray-600">Points réseau</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-700">{chartData.load.length}</div>
            <div className="text-xs text-gray-600">Points load</div>
          </div>
        </div>
      </div>
    </div>
  );
});

NodeExporterCharts.displayName = 'NodeExporterCharts';

export default NodeExporterCharts;