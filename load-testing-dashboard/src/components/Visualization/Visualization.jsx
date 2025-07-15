import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  ChartBarIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
  CpuChipIcon,
  ServerIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { metricsService } from '../../services/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import LoadingSpinner from '../Common/LoadingSpinner';
import LocustMetricsCharts from './LocustMetricsCharts';
import NodeExporterCharts from './NodeExporterCharts';

// Nombre maximum de points de données à conserver dans les graphiques pour la performance
const MAX_DATA_POINTS = 500; // Augmenté pour plus de détails
const UPDATE_THROTTLE_MS = 500; // Réduit pour plus de fluidité


const Visualization = () => {
  const [activeSection, setActiveSection] = useState('locust');
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  
  // Refs pour éviter les re-créations inutiles
  const refreshIntervalRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);
  const dataBufferRef = useRef({ locust: null, node: null });

  // ===================================================================
  //          HISTORIQUE DES DONNÉES AVEC useRef (NOUVELLE APPROCHE)
  // ===================================================================
  
  // Historique Locust - stocké dans une référence pour éviter les re-rendus
  const locustHistoryRef = useRef({
    latestData: null,
    responseTime: [],
    requestsRate: [],
    errorRate: [],
    userCount: [],
    requestsTotal: [],
    failuresTotal: []
  });

  const nodeHistoryRef = useRef({
    latestData: null,
    cpu: [],
    memory: [],
    disk: [],
    network: [],
    load: []
  });

  // Cet état servira à déclencher manuellement le re-rendu des graphiques
  const [historyVersion, setHistoryVersion] = useState(0);

  // Dernières données reçues (pour les métriques instantanées)
  // const [latestLocustData, setLatestLocustData] = useState(null);
  // const [latestNodeData, setLatestNodeData] = useState(null);

  const sections = useMemo(() => [
    {
      id: 'locust',
      name: 'Métriques Locust',
      description: 'Tests de charge et performances',
      icon: CpuChipIcon,
      color: 'text-green-600'
    },
    {
      id: 'node',
      name: 'Métriques Système',
      description: 'Performances serveur et ressources',
      icon: ServerIcon,
      color: 'text-blue-600'
    }
  ], []);

  // ===================================================================
  //                    FONCTIONS D'ACCUMULATION DES DONNÉES
  // ===================================================================

  // Fonction utilitaire pour limiter la taille des tableaux avec optimisation
  const limitDataPoints = useCallback((dataArray) => {
    if (dataArray.length <= MAX_DATA_POINTS) return dataArray;
    // Garder les points les plus récents
    return dataArray.slice(-MAX_DATA_POINTS);
  }, []);

  // Fonction pour vérifier si les données ont significativement changé
  const hasSignificantChange = useCallback((oldData, newData, threshold = 0.1) => {
    if (!oldData || !newData) return true;
    
    // Comparer les métriques clés pour un rendu plus fluide
    const oldValue = oldData.avg_response_time || 0;
    const newValue = newData.avg_response_time || 0;
    
    // Seuil plus bas pour plus de réactivité
    return Math.abs(oldValue - newValue) > (threshold * 0.5);
  }, []);

  // Accumulation des données Locust avec throttling et useRef
  const accumulateLocustData = useCallback((newData) => {
    if (!newData || !newData.stats) return;

    const now = Date.now();
    // Throttle les mises à jour
    if (now - lastUpdateTimeRef.current < UPDATE_THROTTLE_MS) {
      dataBufferRef.current.locust = newData;
      return;
    }
    

    const dataToProcess = dataBufferRef.current.locust || newData;
    lastUpdateTimeRef.current = now;
    
    const timestamp = new Date().toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    
    const aggregatedStats = dataToProcess.stats.find(stat => stat.name === 'Aggregated') || {};

    // Vérifier si les données ont changé de manière significative
    const currentHistory = locustHistoryRef.current;
    const lastPoint = currentHistory.responseTime[currentHistory.responseTime.length - 1];
    if (lastPoint && !hasSignificantChange(lastPoint, aggregatedStats)) {
      return;
    }

    // Mutez directement les tableaux dans la référence
    const newHistory = locustHistoryRef.current;
    newHistory.latestData = dataToProcess; // Stockez les dernières données ici


    // Point de données pour les temps de réponse
    const responseTimePoint = {
      time: timestamp,
      avg: Math.round(aggregatedStats.avg_response_time || 0),
      median: Math.round(aggregatedStats.median_response_time || 0),
      p95: Math.round(aggregatedStats['95%_response_time'] || 0),
      min: Math.round(aggregatedStats.min_response_time || 0),
      max: Math.round(aggregatedStats.max_response_time || 0)
    };

    // Point de données pour le taux de requêtes
    const requestsRatePoint = {
      time: timestamp,
      rps: Math.round((aggregatedStats.current_rps || 0) * 10) / 10,
      totalRps: Math.round((aggregatedStats.total_rps || 0) * 10) / 10
    };

    // Point de données pour les erreurs
    const errorRatePoint = {
      time: timestamp,
      errorRate: aggregatedStats.num_requests > 0 ? 
        Math.round((aggregatedStats.num_failures / aggregatedStats.num_requests) * 100 * 10) / 10 : 0,
      failures: aggregatedStats.num_failures || 0,
      requests: aggregatedStats.num_requests || 0
    };

    // Point de données pour les utilisateurs
    const userCountPoint = {
      time: timestamp,
      users: dataToProcess.user_count || 0,
      state: dataToProcess.state === 'running' ? 1 : 0
    };

    // Point de données pour le total des requêtes
    const requestsTotalPoint = {
      time: timestamp,
      total: aggregatedStats.num_requests || 0,
      successes: (aggregatedStats.num_requests || 0) - (aggregatedStats.num_failures || 0),
      failures: aggregatedStats.num_failures || 0
    };

    // Ajouter les nouveaux points et limiter la taille
    
    newHistory.responseTime = limitDataPoints([...newHistory.responseTime, responseTimePoint]);
    newHistory.requestsRate = limitDataPoints([...newHistory.requestsRate, requestsRatePoint]);
    newHistory.errorRate = limitDataPoints([...newHistory.errorRate, errorRatePoint]);
    newHistory.userCount = limitDataPoints([...newHistory.userCount, userCountPoint]);
    newHistory.requestsTotal = limitDataPoints([...newHistory.requestsTotal, requestsTotalPoint]);

    // Mettre à jour les dernières données
    //setLatestLocustData(dataToProcess);
    setLastUpdate(new Date());
    
    // Forcez un re-rendu des graphiques en changeant la version
    setHistoryVersion(v => v + 1);
    
    // Nettoyer le buffer
    dataBufferRef.current.locust = null;
  }, [limitDataPoints, hasSignificantChange]);

  // Accumulation des données Node Exporter avec throttling et useRef
  const accumulateNodeData = useCallback((newData) => {
    if (!newData) return;

    const timestamp = new Date().toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });

    // Fonction utilitaire pour traiter les métriques Prometheus
    const processMetricData = (metricData) => {
      if (!metricData || !metricData.data || !metricData.data.result) return [];
      return metricData.data.result;
    };

    const cpuData = processMetricData(newData['rate(node_cpu_seconds_total[5m])']);
    const memoryTotal = processMetricData(newData['node_memory_MemTotal_bytes']);
    const memoryAvailable = processMetricData(newData['node_memory_MemAvailable_bytes']);
    const diskSize = processMetricData(newData['node_filesystem_size_bytes']);
    const diskAvail = processMetricData(newData['node_filesystem_avail_bytes']);
    const networkRx = processMetricData(newData['node_network_receive_bytes_total']);
    const networkTx = processMetricData(newData['node_network_transmit_bytes_total']);
    const load1 = processMetricData(newData['node_load1']);
    const load5 = processMetricData(newData['node_load5']);
    const load15 = processMetricData(newData['node_load15']);

    // Mutez directement les tableaux dans la référence
    const newHistory = nodeHistoryRef.current;
    newHistory.latestData = newData; // Stockez les dernières données ici

    // Calculs pour CPU
    const calculateCpuUsage = () => {
      if (!cpuData.length) return 0;
      const totalUsage = cpuData.reduce((sum, cpu) => {
        const value = parseFloat(cpu.value[1]);
        return sum + (isNaN(value) ? 0 : value * 100);
      }, 0);
      return Math.round(totalUsage / cpuData.length);
    };

    // Calculs pour mémoire
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

    // Calculs pour disque
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

    // Calculs pour réseau
    const calculateNetworkUsage = () => {
      if (!networkRx.length || !networkTx.length) return { rx: 0, tx: 0 };
      const rx = Math.round(parseFloat(networkRx[0].value[1]) / 1024 / 1024);
      const tx = Math.round(parseFloat(networkTx[0].value[1]) / 1024 / 1024);
      return { rx, tx };
    };

    const cpuUsage = calculateCpuUsage();
    const memoryUsage = calculateMemoryUsage();
    const diskUsage = calculateDiskUsage();
    const networkUsage = calculateNetworkUsage();

    // Points de données
    const cpuPoint = {
      time: timestamp,
      usage: cpuUsage,
      cores: cpuData.length
    };

    const memoryPoint = {
      time: timestamp,
      used: memoryUsage.used,
      total: memoryUsage.total,
      percentage: memoryUsage.percentage,
      available: memoryUsage.total - memoryUsage.used
    };

    const diskPoint = {
      time: timestamp,
      used: diskUsage.used,
      total: diskUsage.total,
      percentage: diskUsage.percentage,
      available: diskUsage.total - diskUsage.used
    };

    const networkPoint = {
      time: timestamp,
      rx: networkUsage.rx,
      tx: networkUsage.tx,
      total: networkUsage.rx + networkUsage.tx
    };

    const loadPoint = {
      time: timestamp,
      load1: load1.length ? Math.round(parseFloat(load1[0].value[1]) * 100) / 100 : 0,
      load5: load5.length ? Math.round(parseFloat(load5[0].value[1]) * 100) / 100 : 0,
      load15: load15.length ? Math.round(parseFloat(load15[0].value[1]) * 100) / 100 : 0
    };

    // Ajouter les nouveaux points et limiter la taille
    newHistory.cpu = limitDataPoints([...newHistory.cpu, cpuPoint]);
    newHistory.memory = limitDataPoints([...newHistory.memory, memoryPoint]);
    newHistory.disk = limitDataPoints([...newHistory.disk, diskPoint]);
    newHistory.network = limitDataPoints([...newHistory.network, networkPoint]);
    newHistory.load = limitDataPoints([...newHistory.load, loadPoint]);

    // Mettre à jour les dernières données
    //setLatestNodeData(newData);
    setLastUpdate(new Date());
    
    // Forcez un re-rendu des graphiques en changeant la version
    setHistoryVersion(v => v + 1);
  }, [limitDataPoints]);

  // ===================================================================
  //                    GESTION DES WEBSOCKETS ET API
  // ===================================================================

  // Écouter les événements WebSocket pour les métriques Locust
  useWebSocket('stats_update', useCallback((data) => {
    accumulateLocustData(data.stats);
  }, [accumulateLocustData]));

  useWebSocket('test_started', useCallback(() => {
    setIsTestRunning(true);
    setAutoRefresh(true);
  }, []));

  useWebSocket('test_stopped', useCallback(() => {
    setIsTestRunning(false);
    setAutoRefresh(false);
  }, []));

  useWebSocket('test_completed', useCallback(() => {
    setIsTestRunning(false);
    setAutoRefresh(false);
  }, []));

  // Fonction pour récupérer les données Locust
  const fetchLocustData = useCallback(async () => {
    try {
      const data = await metricsService.getLocustMetrics();
      accumulateLocustData(data);
    } catch (error) {
      console.error('Erreur récupération métriques Locust:', error);
    }
  }, [accumulateLocustData]);

  // Fonction pour récupérer les données Node Exporter via Prometheus
  const fetchNodeData = useCallback(async () => {
    try {
      const queries = [
        'up{job="node_exporter"}',
        'node_cpu_seconds_total',
        'node_memory_MemTotal_bytes',
        'node_memory_MemAvailable_bytes',
        'node_filesystem_size_bytes',
        'node_filesystem_avail_bytes',
        'node_network_receive_bytes_total',
        'node_network_transmit_bytes_total',
        'node_load1',
        'node_load5',
        'node_load15',
        'rate(node_cpu_seconds_total[5m])',
        'node_disk_read_bytes_total',
        'node_disk_written_bytes_total'
      ];

      const results = {};
      for (const query of queries) {
        try {
          const result = await metricsService.query(query);
          results[query] = result;
        } catch (error) {
          console.error(`Erreur requête ${query}:`, error);
          results[query] = null;
        }
      }
      
      console.log('Données Node récupérées:', results); // Debug
      accumulateNodeData(results);
    } catch (error) {
      console.error('Erreur récupération métriques Node:', error);
    }
  }, [accumulateNodeData]);

  // Fonction pour récupérer toutes les données
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      // Récupérer les données Locust seulement si pas de test en cours (pour éviter les doublons avec WebSocket)
      if (!isTestRunning) {
        await fetchLocustData();
      }
      await fetchNodeData();
    } catch (error) {
      console.error('Erreur récupération données:', error);
    } finally {
      setLoading(false);
    }
  }, [isTestRunning, fetchLocustData, fetchNodeData]);

  // Fonction pour vider l'historique avec useRef
  const clearHistory = useCallback(() => {
    // Réinitialisez les références
    locustHistoryRef.current = {
      responseTime: [],
      requestsRate: [],
      errorRate: [],
      userCount: [],
      requestsTotal: [],
      failuresTotal: []
    };
    nodeHistoryRef.current = {
      cpu: [],
      memory: [],
      disk: [],
      network: [],
      load: []
    };
    
    // Réinitialisez les autres états
    // setLatestLocustData(null);
    // setLatestNodeData(null);
    setLastUpdate(null);
    
    // Forcez le re-rendu pour afficher les graphiques vides
    setHistoryVersion(v => v + 1);
    
    // Nettoyer les buffers
    dataBufferRef.current = { locust: null, node: null };
  }, []);

  // ===================================================================
  //                    EFFETS ET GESTION DU CYCLE DE VIE
  // ===================================================================

  // Effet pour le chargement initial
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Effet pour l'auto-refresh des métriques Node uniquement
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchNodeData, 2000); // Refresh Node toutes les 2 secondes pour plus de fluidité
      refreshIntervalRef.current = interval;
      return () => {
        clearInterval(interval);
        refreshIntervalRef.current = null;
      };
    }
  }, [autoRefresh, fetchNodeData]);

  // Nettoyage lors du démontage
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // ===================================================================
  //                    GESTIONNAIRES D'ÉVÉNEMENTS
  // ===================================================================

  const handleRefresh = useCallback(() => {
    fetchAllData();
  }, [fetchAllData]);

  const toggleAutoRefresh = useCallback(() => {
    setAutoRefresh(prev => !prev);
  }, []);

  // Mémoriser les données pour éviter les re-rendus inutiles
  //const memoizedLatestLocustData = useMemo(() => latestLocustData, [latestLocustData]);
  //const memoizedLatestNodeData = useMemo(() => latestNodeData, [latestNodeData]);

  // ===================================================================
  //                    RENDU DU COMPOSANT
  // ===================================================================

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Visualisation des Métriques</h2>
          <p className="text-gray-600 mt-1">
            Graphiques Canvas haute performance avec historique accumulé ({MAX_DATA_POINTS} points max)
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {isTestRunning && (
            <div className="flex items-center space-x-2 px-3 py-1 bg-success-50 rounded-full">
              <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-success-700">
                Flux temps réel
              </span>
            </div>
          )}
          
          {lastUpdate && (
            <span className="text-sm text-gray-500">
              MAJ: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
            <span>{autoRefresh ? 'Continu' : 'Manuel'}</span>
          </div>
          
          <button
            onClick={clearHistory}
            className="flex items-center space-x-2 px-3 py-1 rounded-md text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
            title="Vider l'historique"
          >
            <TrashIcon className="h-4 w-4" />
            <span>Vider</span>
          </button>
          
          <button
            onClick={toggleAutoRefresh}
            className={`flex items-center space-x-2 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              autoRefresh 
                ? 'bg-success-100 text-success-700 hover:bg-success-200' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {autoRefresh ? <EyeIcon className="h-4 w-4" /> : <EyeSlashIcon className="h-4 w-4" />}
            <span>{autoRefresh ? 'Auto' : 'Manuel'}</span>
          </button>
          
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="btn-outline"
          >
            {loading ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <ArrowPathIcon className="h-4 w-4 mr-2" />
            )}
            Actualiser
          </button>
        </div>
      </div>

      {/* Navigation sections */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-md text-sm font-medium transition-colors duration-200 ${
                activeSection === section.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className={`h-5 w-5 ${activeSection === section.id ? section.color : ''}`} />
              <div className="text-left">
                <div>{section.name}</div>
                <div className="text-xs text-gray-500">{section.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Statistiques de l'historique */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4">
          <h4 className="font-medium text-gray-900 mb-2">Historique Locust</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Points temps réponse:</span>
              <span className="font-medium ml-2">{locustHistoryRef.current.responseTime.length}</span>
            </div>
            <div>
              <span className="text-gray-500">Points utilisateurs:</span>
              <span className="font-medium ml-2">{locustHistoryRef.current.userCount.length}</span>
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <h4 className="font-medium text-gray-900 mb-2">Historique Système</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Points CPU:</span>
              <span className="font-medium ml-2">{nodeHistoryRef.current.cpu.length}</span>
            </div>
            <div>
              <span className="text-gray-500">Points mémoire:</span>
              <span className="font-medium ml-2">{nodeHistoryRef.current.memory.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu des graphiques avec nouvelles props */}
      <div className="space-y-6">
        {activeSection === 'locust' && (
          <LocustMetricsCharts 
            historyRef={locustHistoryRef}
            historyVersion={historyVersion}
            //latestData={memoizedLatestLocustData}
            loading={loading}
          />
        )}
        
        {activeSection === 'node' && (
          <NodeExporterCharts 
            historyRef={nodeHistoryRef}
            historyVersion={historyVersion}
            //latestData={memoizedLatestNodeData}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};

export default Visualization;