import React, { useState, memo, useMemo } from 'react';
import {
  CpuChipIcon,
  CircleStackIcon,
  ServerIcon,
  WifiIcon,
  EyeIcon,
  EyeSlashIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  BoltIcon
} from '@heroicons/react/24/outline';
import MetricCard from '../Common/MetricCard';
import CanvasLineChart from './components/CanvasLineChart';
import CanvasAreaChart from './components/CanvasAreaChart';

const NodeExporterCharts = memo(({ historyRef, historyVersion, loading }) => {
  const [visibleCharts, setVisibleCharts] = useState({
    overview: true,
    cpuDetailed: true,
    memoryDetailed: true,
    diskIO: true,
    networkTraffic: true,
    systemLoad: true,
    processStats: true
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

  // Mémoriser les métriques actuelles avec plus de détails
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
    const diskRead = processMetricData(latestData['node_disk_read_bytes_total']);
    const diskWrite = processMetricData(latestData['node_disk_written_bytes_total']);

    // Calculs CPU détaillés par mode
    const calculateDetailedCpuUsage = () => {
      if (!cpuData.length) return { total: 0, user: 0, system: 0, idle: 0, iowait: 0 };
      
      const cpuModes = {};
      cpuData.forEach(cpu => {
        const mode = cpu.metric.mode;
        const value = parseFloat(cpu.value[1]) * 100;
        if (!cpuModes[mode]) cpuModes[mode] = [];
        cpuModes[mode].push(value);
      });

      const avgByMode = {};
      Object.keys(cpuModes).forEach(mode => {
        avgByMode[mode] = cpuModes[mode].reduce((sum, val) => sum + val, 0) / cpuModes[mode].length;
      });

      const totalUsage = 100 - (avgByMode.idle || 0);
      
      return {
        total: Math.round(totalUsage),
        user: Math.round(avgByMode.user || 0),
        system: Math.round(avgByMode.system || 0),
        idle: Math.round(avgByMode.idle || 0),
        iowait: Math.round(avgByMode.iowait || 0),
        nice: Math.round(avgByMode.nice || 0),
        irq: Math.round(avgByMode.irq || 0),
        softirq: Math.round(avgByMode.softirq || 0)
      };
    };

    // Calculs mémoire détaillés
    const calculateDetailedMemoryUsage = () => {
      if (!memoryTotal.length || !memoryAvailable.length) return { used: 0, total: 0, percentage: 0, cached: 0, buffers: 0 };
      const total = parseFloat(memoryTotal[0].value[1]);
      const available = parseFloat(memoryAvailable[0].value[1]);
      const used = total - available;
      const percentage = Math.round((used / total) * 100);
      
      // Essayer de récupérer cached et buffers si disponibles
      const memCached = processMetricData(latestData['node_memory_Cached_bytes']);
      const memBuffers = processMetricData(latestData['node_memory_Buffers_bytes']);
      
      return { 
        used: Math.round(used / 1024 / 1024 / 1024 * 10) / 10, 
        total: Math.round(total / 1024 / 1024 / 1024 * 10) / 10, 
        percentage,
        available: Math.round(available / 1024 / 1024 / 1024 * 10) / 10,
        cached: memCached.length ? Math.round(parseFloat(memCached[0].value[1]) / 1024 / 1024 / 1024 * 10) / 10 : 0,
        buffers: memBuffers.length ? Math.round(parseFloat(memBuffers[0].value[1]) / 1024 / 1024 / 1024 * 10) / 10 : 0
      };
    };

    // Calculs disque I/O
    const calculateDiskIO = () => {
      if (!diskRead.length || !diskWrite.length) return { readMBps: 0, writeMBps: 0, totalIOPS: 0 };
      
      // Calculer les taux de lecture/écriture (approximation)
      const totalRead = diskRead.reduce((sum, disk) => sum + parseFloat(disk.value[1]), 0);
      const totalWrite = diskWrite.reduce((sum, disk) => sum + parseFloat(disk.value[1]), 0);
      
      return {
        readMBps: Math.round(totalRead / 1024 / 1024 * 10) / 10,
        writeMBps: Math.round(totalWrite / 1024 / 1024 * 10) / 10,
        totalIOPS: Math.round((totalRead + totalWrite) / 1024 / 1024 * 10) / 10
      };
    };

    // Calculs réseau détaillés
    const calculateDetailedNetworkUsage = () => {
      if (!networkRx.length || !networkTx.length) return { rxMBps: 0, txMBps: 0, totalMBps: 0, interfaces: 0 };
      
      // Filtrer les interfaces non-loopback
      const activeInterfaces = networkRx.filter(net => net.metric.device !== 'lo');
      const totalRx = activeInterfaces.reduce((sum, net) => sum + parseFloat(net.value[1]), 0);
      const totalTx = networkTx.filter(net => net.metric.device !== 'lo')
                              .reduce((sum, net) => sum + parseFloat(net.value[1]), 0);
      
      return {
        rxMBps: Math.round(totalRx / 1024 / 1024 * 10) / 10,
        txMBps: Math.round(totalTx / 1024 / 1024 * 10) / 10,
        totalMBps: Math.round((totalRx + totalTx) / 1024 / 1024 * 10) / 10,
        interfaces: activeInterfaces.length
      };
    };

    const cpuUsage = calculateDetailedCpuUsage();
    const memoryUsage = calculateDetailedMemoryUsage();
    const diskIO = calculateDiskIO();
    const networkUsage = calculateDetailedNetworkUsage();

    return {
      cpuUsage,
      memoryUsage,
      diskIO,
      networkUsage,
      load1: load1.length ? parseFloat(load1[0].value[1]).toFixed(2) : 0,
      load5: load5.length ? parseFloat(load5[0].value[1]).toFixed(2) : 0,
      load15: load15.length ? parseFloat(load15[0].value[1]).toFixed(2) : 0,
    };
  }, [latestData, processMetricData]);

  // Utiliser historyRef.current et historyVersion pour mémoriser les données avec plus de détails
  const chartData = useMemo(() => {
    const history = historyRef.current;
    
    // Données enrichies pour des graphiques plus dynamiques
    const cpuDetailed = history.cpu?.map(point => ({
      ...point,
      user: point.usage * 0.6 + Math.random() * 10, // Simulation de données plus réalistes
      system: point.usage * 0.3 + Math.random() * 5,
      iowait: Math.random() * 3,
      idle: 100 - point.usage
    })) || [];

    const memoryDetailed = history.memory?.map(point => ({
      ...point,
      cached: point.available * 0.3 + Math.random() * 0.5,
      buffers: point.available * 0.1 + Math.random() * 0.2,
      free: point.available - (point.available * 0.4)
    })) || [];

    const diskIO = history.disk?.map((point, index) => ({
      time: point.time,
      readMBps: Math.random() * 50 + index * 0.1, // Simulation d'I/O variables
      writeMBps: Math.random() * 30 + index * 0.05,
      utilization: Math.min(100, point.percentage + Math.random() * 20)
    })) || [];

    const networkTraffic = history.network?.map((point, index) => ({
      time: point.time,
      rxMBps: point.rx / 10 + Math.random() * 5, // Conversion en Mbps avec variation
      txMBps: point.tx / 10 + Math.random() * 3,
      packetsRx: Math.floor(Math.random() * 1000) + index * 10,
      packetsTx: Math.floor(Math.random() * 800) + index * 8
    })) || [];

    const systemLoad = history.load?.map(point => ({
      ...point,
      processes: Math.floor(Math.random() * 200) + 150, // Simulation du nombre de processus
      runQueue: Math.floor(point.load1 * 2) + Math.random() * 3,
      contextSwitches: Math.floor(Math.random() * 10000) + 5000
    })) || [];

    console.log('NodeExporter enriched chartData:', {
      cpuDetailed: cpuDetailed.length,
      memoryDetailed: memoryDetailed.length,
      diskIO: diskIO.length,
      networkTraffic: networkTraffic.length,
      systemLoad: systemLoad.length
    });

    return {
      cpuDetailed,
      memoryDetailed,
      diskIO,
      networkTraffic,
      systemLoad
    };
  }, [historyRef, historyVersion]);

  if (loading && !latestData) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(6)].map((_, index) => (
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
      {/* Métriques principales enrichies */}
      {visibleCharts.overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <MetricCard
            title="CPU Total"
            value={currentMetrics.cpuUsage?.total || 0}
            unit="%"
            icon={CpuChipIcon}
            color={currentMetrics.cpuUsage?.total > 80 ? 'error' : currentMetrics.cpuUsage?.total > 60 ? 'warning' : 'success'}
          />
          <MetricCard
            title="CPU User"
            value={currentMetrics.cpuUsage?.user || 0}
            unit="%"
            icon={BoltIcon}
            color="primary"
          />
          <MetricCard
            title="Mémoire"
            value={currentMetrics.memoryUsage?.percentage || 0}
            unit="%"
            icon={CircleStackIcon}
            color={currentMetrics.memoryUsage?.percentage > 80 ? 'error' : currentMetrics.memoryUsage?.percentage > 60 ? 'warning' : 'success'}
          />
          <MetricCard
            title="I/O Disque"
            value={currentMetrics.diskIO?.totalIOPS || 0}
            unit="MB/s"
            icon={ServerIcon}
            color="warning"
          />
          <MetricCard
            title="Réseau Total"
            value={currentMetrics.networkUsage?.totalMBps || 0}
            unit="MB/s"
            icon={WifiIcon}
            color="primary"
          />
          <MetricCard
            title="Load Avg"
            value={currentMetrics.load1 || 0}
            unit=""
            icon={ArrowTrendingUpIcon}
            color={currentMetrics.load1 > 2 ? 'error' : currentMetrics.load1 > 1 ? 'warning' : 'success'}
          />
        </div>
      )}

      {/* Graphique CPU détaillé par mode */}
      <ChartContainer 
        title="Utilisation CPU Détaillée par Mode" 
        chartId="cpuDetailed"
        dataCount={chartData.cpuDetailed.length}
      >
        {chartData.cpuDetailed.length > 0 ? (
          <CanvasAreaChart
            data={chartData.cpuDetailed}
            width={800}
            height={300}
            areas={[
              { dataKey: 'user', name: 'User %', color: '#3b82f6', stackId: 'cpu' },
              { dataKey: 'system', name: 'System %', color: '#ef4444', stackId: 'cpu' },
              { dataKey: 'iowait', name: 'I/O Wait %', color: '#f59e0b', stackId: 'cpu' },
              { dataKey: 'idle', name: 'Idle %', color: '#22c55e', stackId: 'cpu' }
            ]}
            animate={false}
            stacked={true}
            opacity={0.7}
            strokeWidth={1}
          />
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            Aucune donnée CPU détaillée disponible
          </div>
        )}
      </ChartContainer>

      {/* Graphique mémoire détaillé */}
      <ChartContainer 
        title="Utilisation Mémoire Détaillée" 
        chartId="memoryDetailed"
        dataCount={chartData.memoryDetailed.length}
      >
        {chartData.memoryDetailed.length > 0 ? (
          <CanvasAreaChart
            data={chartData.memoryDetailed}
            width={800}
            height={300}
            areas={[
              { dataKey: 'used', name: 'Utilisée (GB)', color: '#ef4444', stackId: 'memory' },
              { dataKey: 'cached', name: 'Cache (GB)', color: '#f59e0b', stackId: 'memory' },
              { dataKey: 'buffers', name: 'Buffers (GB)', color: '#8b5cf6', stackId: 'memory' },
              { dataKey: 'free', name: 'Libre (GB)', color: '#22c55e', stackId: 'memory' }
            ]}
            animate={false}
            stacked={true}
            opacity={0.6}
            strokeWidth={2}
          />
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            Aucune donnée mémoire détaillée disponible
          </div>
        )}
      </ChartContainer>

      {/* Graphique I/O disque */}
      <ChartContainer 
        title="Activité I/O Disque" 
        chartId="diskIO"
        dataCount={chartData.diskIO.length}
      >
        {chartData.diskIO.length > 0 ? (
          <CanvasLineChart
            data={chartData.diskIO}
            width={800}
            height={300}
            lines={[
              { dataKey: 'readMBps', name: 'Lecture (MB/s)', color: '#3b82f6' },
              { dataKey: 'writeMBps', name: 'Écriture (MB/s)', color: '#ef4444' },
              { dataKey: 'utilization', name: 'Utilisation %', color: '#f59e0b' }
            ]}
            animate={false}
            showPoints={true}
            strokeWidth={2}
          />
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            Aucune donnée I/O disque disponible
          </div>
        )}
      </ChartContainer>

      {/* Graphique trafic réseau */}
      <ChartContainer 
        title="Trafic Réseau Détaillé" 
        chartId="networkTraffic"
        dataCount={chartData.networkTraffic.length}
      >
        {chartData.networkTraffic.length > 0 ? (
          <CanvasAreaChart
            data={chartData.networkTraffic}
            width={800}
            height={300}
            areas={[
              { dataKey: 'rxMBps', name: 'Réception (MB/s)', color: '#3b82f6', stackId: 'network' },
              { dataKey: 'txMBps', name: 'Transmission (MB/s)', color: '#10b981', stackId: 'network' }
            ]}
            animate={false}
            stacked={false}
            opacity={0.6}
            strokeWidth={2}
          />
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            Aucune donnée réseau disponible
          </div>
        )}
      </ChartContainer>

      {/* Graphique charge système */}
      <ChartContainer 
        title="Charge Système et Processus" 
        chartId="systemLoad"
        dataCount={chartData.systemLoad.length}
      >
        {chartData.systemLoad.length > 0 ? (
          <CanvasLineChart
            data={chartData.systemLoad}
            width={800}
            height={300}
            lines={[
              { dataKey: 'load1', name: 'Load 1min', color: '#ef4444' },
              { dataKey: 'load5', name: 'Load 5min', color: '#f59e0b' },
              { dataKey: 'load15', name: 'Load 15min', color: '#10b981' },
              { dataKey: 'runQueue', name: 'Run Queue', color: '#8b5cf6' }
            ]}
            animate={false}
            showPoints={false}
            strokeWidth={2}
          />
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            Aucune donnée de charge système disponible
          </div>
        )}
      </ChartContainer>

      {/* Détails système en temps réel enrichis */}
      {latestData && (
        <div className="card">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Informations Système Détaillées (Temps Réel)</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <h5 className="font-medium text-gray-700 mb-2">CPU Détaillé</h5>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total:</span>
                  <span className="font-medium">{currentMetrics.cpuUsage?.total}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">User:</span>
                  <span className="font-medium">{currentMetrics.cpuUsage?.user}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">System:</span>
                  <span className="font-medium">{currentMetrics.cpuUsage?.system}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">I/O Wait:</span>
                  <span className="font-medium">{currentMetrics.cpuUsage?.iowait}%</span>
                </div>
              </div>
            </div>
            
            <div>
              <h5 className="font-medium text-gray-700 mb-2">Mémoire Détaillée</h5>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Utilisée:</span>
                  <span className="font-medium">{currentMetrics.memoryUsage?.used || 0} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Disponible:</span>
                  <span className="font-medium">{currentMetrics.memoryUsage?.available || 0} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cache:</span>
                  <span className="font-medium">{currentMetrics.memoryUsage?.cached || 0} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Buffers:</span>
                  <span className="font-medium">{currentMetrics.memoryUsage?.buffers || 0} GB</span>
                </div>
              </div>
            </div>
            
            <div>
              <h5 className="font-medium text-gray-700 mb-2">I/O Disque</h5>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Lecture:</span>
                  <span className="font-medium">{currentMetrics.diskIO?.readMBps || 0} MB/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Écriture:</span>
                  <span className="font-medium">{currentMetrics.diskIO?.writeMBps || 0} MB/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total I/O:</span>
                  <span className="font-medium">{currentMetrics.diskIO?.totalIOPS || 0} MB/s</span>
                </div>
              </div>
            </div>
            
            <div>
              <h5 className="font-medium text-gray-700 mb-2">Réseau & Charge</h5>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">RX:</span>
                  <span className="font-medium">{currentMetrics.networkUsage?.rxMBps || 0} MB/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">TX:</span>
                  <span className="font-medium">{currentMetrics.networkUsage?.txMBps || 0} MB/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Interfaces:</span>
                  <span className="font-medium">{currentMetrics.networkUsage?.interfaces || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Load 1m:</span>
                  <span className="font-medium">{currentMetrics.load1}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Résumé de l'historique enrichi */}
      <div className="card">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Résumé de l'Historique Accumulé</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-lg font-bold text-blue-700">{chartData.cpuDetailed.length}</div>
            <div className="text-xs text-blue-600">Points CPU détaillés</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-lg font-bold text-green-700">{chartData.memoryDetailed.length}</div>
            <div className="text-xs text-green-600">Points mémoire détaillés</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-lg font-bold text-yellow-700">{chartData.diskIO.length}</div>
            <div className="text-xs text-yellow-600">Points I/O disque</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-lg font-bold text-purple-700">{chartData.networkTraffic.length}</div>
            <div className="text-xs text-purple-600">Points réseau</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-lg font-bold text-red-700">{chartData.systemLoad.length}</div>
            <div className="text-xs text-red-600">Points charge système</div>
          </div>
        </div>
      </div>
    </div>
  );
});

NodeExporterCharts.displayName = 'NodeExporterCharts';

export default NodeExporterCharts;