import React, { useState, useEffect } from 'react';
import { 
  ClockIcon, 
  ChartBarIcon, 
  ArrowTopRightOnSquareIcon,
  EyeIcon,
  PresentationChartLineIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { testService } from '../../services/api';
import LoadingSpinner from '../Common/LoadingSpinner';
import { cn } from '../../utils/cn';

const TestHistory = ({ onNavigateToVisualization, isTestRunning }) => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTest, setSelectedTest] = useState(null);

  useEffect(() => {
    loadTestHistory();
  }, []);

  const loadTestHistory = async () => {
    try {
      setLoading(true);
      const history = await testService.getTestHistory();
      setTests(history);
    } catch (error) {
      console.error('Erreur chargement historique:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: { label: 'Terminé', class: 'badge-success' },
      running: { label: 'En cours', class: 'badge-info' },
      stopped: { label: 'Arrêté', class: 'badge-warning' },
      failed: { label: 'Échec', class: 'badge-error' }
    };

    const config = statusConfig[status] || { label: status, class: 'badge-gray' };
    return <span className={cn('badge', config.class)}>{config.label}</span>;
  };

  const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return '-';
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end - start;
    
    if (durationMs < 0) return 'N/A';

    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  };

  const handleViewVisualization = (test) => {
    if (isTestRunning) {
      alert('Impossible de voir les données historiques pendant qu\'un test est en cours. Arrêtez le test actuel d\'abord.');
      return;
    }
    
    // Naviguer vers la page visualisation
    onNavigateToVisualization();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Historique des Tests</h2>
          <p className="text-gray-600 mt-1">
            Consultez les résultats de vos tests précédents
          </p>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
            <span className="ml-3 text-gray-600">Chargement de l'historique...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Historique des Tests</h2>
          <p className="text-gray-600 mt-1">
            Consultez les résultats de vos tests précédents
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {isTestRunning && (
            <div className="flex items-center space-x-2 px-3 py-1 bg-warning-50 rounded-full">
              <div className="w-2 h-2 bg-warning-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-warning-700">
                Test en cours - Visualisation historique désactivée
              </span>
            </div>
          )}
          
        <button
          onClick={loadTestHistory}
          className="btn-outline"
        >
          Actualiser
        </button>
        </div>
      </div>

      {/* Liste des tests */}
      {tests.length === 0 ? (
        <div className="card text-center py-12">
          <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Aucun test dans l'historique
          </h3>
          <p className="text-gray-500">
            Les tests que vous lancerez apparaîtront ici
          </p>
        </div>
      ) : (
        <div className="card p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Test
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date de début
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Durée
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Performances
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tests.map((test) => (
                  <tr key={test.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {test.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {test.users} utilisateurs • {test.target_url}
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(test.status)}
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {test.start_time ? 
                        format(new Date(test.start_time), 'dd MMM yyyy HH:mm', { locale: fr }) : 
                        '-'
                      }
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDuration(test.start_time, test.end_time)}
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {test.avg_response_time != null ? (
                          <div className="space-y-1">
                            <div>Temps: {Math.round(test.avg_response_time)}ms</div>
                            <div>RPS: {test.requests_per_second?.toFixed(1) || 0}</div>
                            <div>Erreurs: {test.error_rate?.toFixed(1) || 0}%</div>
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedTest(test)}
                          className="text-primary-600 hover:text-primary-900"
                          title="Voir les détails"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={() => handleViewVisualization(test)}
                          className={cn(
                            'text-purple-600 hover:text-purple-900',
                            isTestRunning && 'opacity-50 cursor-not-allowed'
                          )}
                          disabled={isTestRunning}
                          title="Voir les graphiques"
                        >
                          <PresentationChartLineIcon className="h-4 w-4" />
                        </button>
                        
                        <a
                          href="http://localhost:8089"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-900"
                          title="Ouvrir Locust"
                        >
                          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal détails test */}
      {selectedTest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b">
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Détails du test: {selectedTest.name}
                </h3>
                <button
                  onClick={() => setSelectedTest(null)}
                  className="p-1 rounded-full hover:bg-gray-200"
                >
                  <span className="text-2xl text-gray-500">&times;</span>
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div>
                  <p className="font-semibold text-gray-700">Configuration</p>
                  <dl className="mt-2 space-y-2">
                    <div className="flex justify-between"><dt className="text-gray-500">URL cible</dt><dd className="font-medium text-right">{selectedTest.target_url}</dd></div>
                    <div className="flex justify-between"><dt className="text-gray-500">Utilisateurs</dt><dd className="font-medium">{selectedTest.users}</dd></div>
                    <div className="flex justify-between"><dt className="text-gray-500">Vitesse d'apparition</dt><dd className="font-medium">{selectedTest.spawn_rate}/s</dd></div>
                    <div className="flex justify-between"><dt className="text-gray-500">Durée configurée</dt><dd className="font-medium">{selectedTest.duration === 0 ? 'Illimitée' : `${selectedTest.duration}s`}</dd></div>
                  </dl>
                </div>
                
                <div>
                  <p className="font-semibold text-gray-700">Résultats Agrégés</p>
                   {selectedTest.total_requests != null ? (
                    <dl className="mt-2 space-y-2">
                      <div className="flex justify-between"><dt className="text-gray-500">Total requêtes</dt><dd className="font-medium">{selectedTest.total_requests.toLocaleString()}</dd></div>
                      <div className="flex justify-between"><dt className="text-gray-500">Total échecs</dt><dd className="font-medium">{selectedTest.total_failures?.toLocaleString() || 0}</dd></div>
                      <div className="flex justify-between"><dt className="text-gray-500">Temps réponse moyen</dt><dd className="font-medium">{Math.round(selectedTest.avg_response_time)} ms</dd></div>
                      <div className="flex justify-between"><dt className="text-gray-500">Requêtes / sec</dt><dd className="font-medium">{selectedTest.requests_per_second?.toFixed(2) || '0.00'}</dd></div>
                      <div className="flex justify-between"><dt className="text-gray-500">Taux d'erreur</dt><dd className="font-medium">{selectedTest.error_rate?.toFixed(2) || '0.00'} %</dd></div>
                    </dl>
                   ) : <p className="text-gray-500 mt-2">Aucune statistique finale enregistrée.</p>}
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3">
              <button
                onClick={() => {
                  setSelectedTest(null);
                  handleViewVisualization(selectedTest);
                }}
                disabled={isTestRunning}
                className="btn-primary"
              >
                <PresentationChartLineIcon className="h-4 w-4 mr-2" />
                Voir les Graphiques
              </button>
              
              <button
                onClick={() => setSelectedTest(null)}
                className="btn-outline"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestHistory;
