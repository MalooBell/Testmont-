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
    diskUsage: true,
    networkTraffic: true,
    systemLoad: true
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

  // Mémoriser les métriques actuelles avec données RÉELLES
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

    // Calculs disque usage (NOUVEAU)
    const calculateDiskUsage = () => {
      if (!diskSize.length || !diskAvail.length) return { used: 0, total: 0, percentage: 0, available: 0 };
      
      const total = parseFloat(diskSize[0].value[1]);
      const available = parseFloat(diskAvail[0].value[1]);
      const used = total - available;
      const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
      
      return {
        used: Math.round(used / 1024 / 1024 / 1024 * 10) / 10,
        total: Math.round(total / 1024 / 1024 / 1024 * 10) / 10,
        available: Math.round(available / 1024 / 1024 / 1024 * 10) / 10,
        percentage
      };
    };

    // Calculs réseau détaillés
    const calculateDetailedNetworkUsage = () => {
      if (!networkRx.length || !networkTx.length) return { rxMBps: 0, txMBps: 0, totalMBps: 0, interfaces: 0 };
      
      // Filtrer les interfaces non-loopback et actives
      const activeInterfaces = networkRx.filter(net => net.metric.device !== 'lo');
      
      // Calculer les taux de transfert en utilisant les données de rate() si disponibles
      const networkRxRate = processMetricData(latestData['rate(node_network_receive_bytes_total[5m])']);
      const networkTxRate = processMetricData(latestData['rate(node_network_transmit_bytes_total[5m])']);
      
      let rxMBps = 0;
      let txMBps = 0;
      
      if (networkRxRate.length && networkTxRate.length) {
        // Utiliser les taux calculés par Prometheus (plus précis)
        const activeRxInterfaces = networkRxRate.filter(net => net.metric.device !== 'lo');
        const activeTxInterfaces = networkTxRate.filter(net => net.metric.device !== 'lo');
        
        rxMBps = activeRxInterfaces.reduce((sum, net) => {
          const rate = parseFloat(net.value[1]);
          return sum + (isNaN(rate) ? 0 : Math.max(0, rate));
        }, 0) / 1024 / 1024; // Convertir en MB/s
        
        txMBps = activeTxInterfaces.reduce((sum, net) => {
          const rate = parseFloat(net.value[1]);
          return sum + (isNaN(rate) ? 0 : Math.max(0, rate));
        }, 0) / 1024 / 1024; // Convertir en MB/s
      } else {
        // Fallback : utiliser les valeurs cumulatives (moins précis)
        const totalRx = activeInterfaces.reduce((sum, net) => {
          const value = parseFloat(net.value[1]);
          return sum + (isNaN(value) ? 0 : value);
        }, 0);
        
        const totalTx = networkTx.filter(net => net.metric.device !== 'lo')
                                .reduce((sum, net) => {
                                  const value = parseFloat(net.value[1]);
                                  return sum + (isNaN(value) ? 0 : value);
                                }, 0);
        
        // Estimation approximative du taux (pas très précise)
        rxMBps = totalRx / 1024 / 1024 / 300; // Divisé par 5 minutes en secondes
        txMBps = totalTx / 1024 / 1024 / 300;
      }
      
      return {
        rxMBps: Math.round(rxMBps * 100) / 100,
        txMBps: Math.round(txMBps * 100) / 100,
        totalMBps: Math.round((rxMBps + txMBps) * 100) / 100,
        interfaces: activeInterfaces.length
      };
    };

    const cpuUsage = calculateDetailedCpuUsage();
    const memoryUsage = calculateDetailedMemoryUsage();
    const diskIO = calculateDiskIO();
    const diskUsage = calculateDiskUsage();
    const networkUsage = calculateDetailedNetworkUsage();

    return {
      cpuUsage,
      memoryUsage,
      diskIO,
      diskUsage,
      networkUsage,
      load1: load1.length ? parseFloat(load1[0].value[1]).toFixed(2) : 0,
      load5: load5.length ? parseFloat(load5[0].value[1]).toFixed(2) : 0,
      load15: load15.length ? parseFloat(load15[0].value[1]).toFixed(2) : 0,
    };
  }, [latestData, processMetricData]);

  // Utiliser historyRef.current et historyVersion pour mémoriser les données RÉELLES
  const chartData = useMemo(() => {
    const history = historyRef.current;
    
    return {
      cpuDetailed: history.cpu || [],
      memoryDetailed: history.memory || [],
      diskIO: history.disk || [],
      diskUsage: history.disk || [], // Utiliser les mêmes données pour l'usage disque
      networkTraffic: history.network || [],
      systemLoad: history.load || []
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
            title="Disque"
            value={currentMetrics.diskUsage?.percentage || 0}
            unit="%"
            icon={ServerIcon}
            color={currentMetrics.diskUsage?.percentage > 80 ? 'error' : currentMetrics.diskUsage?.percentage > 60 ? 'warning' : 'success'}
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
            width={1200}
            height={350}
            areas={[
              { dataKey: 'usage', name: 'CPU Total %', color: '#3b82f6' }
            ]}
            animate={true}
            stacked={false}
            opacity={0.7}
            strokeWidth={2}
            useFixedScale={true}
          />
        ) : (
          <div className="h-[350px] flex items-center justify-center text-gray-500">
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
            width={1200}
            height={350}
            areas={[
              { dataKey: 'used', name: 'Utilisée (GB)', color: '#ef4444' },
              { dataKey: 'available', name: 'Disponible (GB)', color: '#22c55e' }
            ]}
            animate={true}
            stacked={false}
            opacity={0.6}
            strokeWidth={2}
            useFixedScale={true}
          />
        ) : (
          <div className="h-[350px] flex items-center justify-center text-gray-500">
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
            width={1200}
            height={350}
            lines={[
              { dataKey: 'percentage', name: 'Utilisation %', color: '#f59e0b' }
            ]}
            animate={true}
            showPoints={true}
            strokeWidth={2}
            useFixedScale={true}
          />
        ) : (
          <div className="h-[350px] flex items-center justify-center text-gray-500">
            Aucune donnée I/O disque disponible
          </div>
        )}
      </ChartContainer>

      {/* NOUVEAU : Graphique usage disque (disksize et diskavail) */}
      <ChartContainer 
        title="Utilisation de l'Espace Disque" 
        chartId="diskUsage"
        dataCount={chartData.diskUsage.length}
      >
        {chartData.diskUsage.length > 0 ? (
          <CanvasAreaChart
            data={chartData.diskUsage}
            width={1200}
            height={350}
            areas={[
              { dataKey: 'used', name: 'Utilisé (GB)', color: '#ef4444', stackId: 'disk' },
              { dataKey: 'available', name: 'Disponible (GB)', color: '#22c55e', stackId: 'disk' }
            ]}
            animate={true}
            stacked={true}
            opacity={0.7}
            strokeWidth={2}
            useFixedScale={true}
          />
        ) : (
          <div className="h-[350px] flex items-center justify-center text-gray-500">
            Aucune donnée d'usage disque disponible
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
            width={1200}
            height={350}
            areas={[
              { dataKey: 'rx', name: 'Réception (MB)', color: '#3b82f6', stackId: 'network' },
              { dataKey: 'tx', name: 'Transmission (MB)', color: '#10b981', stackId: 'network' }
            ]}
            animate={true}
            stacked={false}
            opacity={0.6}
            strokeWidth={2}
            useFixedScale={true}
          />
        ) : (
          <div className="h-[350px] flex items-center justify-center text-gray-500">
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
            width={1200}
            height={350}
            lines={[
              { dataKey: 'load1', name: 'Load 1min', color: '#ef4444' },
              { dataKey: 'load5', name: 'Load 5min', color: '#f59e0b' },
              { dataKey: 'load15', name: 'Load 15min', color: '#10b981' }
            ]}
            animate={true}
            showPoints={false}
            strokeWidth={2}
            useFixedScale={true}
          />
        ) : (
          <div className="h-[350px] flex items-center justify-center text-gray-500">
            Aucune donnée de charge système disponible
          </div>
        )}
      </ChartContainer>

      {/* Détails système en temps réel enrichis */}
      {latestData && (
        <div className="card">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Informations Système Détaillées (Temps Réel)</h4>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
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
              <h5 className="font-medium text-gray-700 mb-2">Espace Disque</h5>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Utilisé:</span>
                  <span className="font-medium">{currentMetrics.diskUsage?.used || 0} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Disponible:</span>
                  <span className="font-medium">{currentMetrics.diskUsage?.available || 0} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total:</span>
                  <span className="font-medium">{currentMetrics.diskUsage?.total || 0} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Usage:</span>
                  <span className="font-medium">{currentMetrics.diskUsage?.percentage || 0}%</span>
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
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-lg font-bold text-blue-700">{chartData.cpuDetailed.length}</div>
            <div className="text-xs text-blue-600">Points CPU</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-lg font-bold text-green-700">{chartData.memoryDetailed.length}</div>
            <div className="text-xs text-green-600">Points mémoire</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-lg font-bold text-yellow-700">{chartData.diskIO.length}</div>
            <div className="text-xs text-yellow-600">Points I/O disque</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-lg font-bold text-orange-700">{chartData.diskUsage.length}</div>
            <div className="text-xs text-orange-600">Points usage disque</div>
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