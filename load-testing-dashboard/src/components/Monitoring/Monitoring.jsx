import React, { useState, useEffect } from 'react';
import { 
  ChartBarIcon, 
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

const Monitoring = () => {
  const [activeTab, setActiveTab] = useState('locust');
  const [iframeState, setIframeState] = useState({
    locust: { loading: true, error: false },
    prometheus: { loading: true, error: false },
  });

  const monitoringTools = [
    {
      id: 'locust',
      name: 'Locust',
      description: 'Interface de test de charge',
      url: 'http://localhost:8089',
      icon: '🦗'
    },
    {
      id: 'prometheus',
      name: 'Prometheus',
      description: 'Métriques et monitoring',
      url: 'http://localhost:9090',
      icon: '🔥'
    }
  ];
  
  // Réinitialiser l'état de chargement lors du changement d'onglet
  useEffect(() => {
    setIframeState(prev => ({
        ...prev,
        [activeTab]: { loading: true, error: false }
    }));
  }, [activeTab]);

  const activeTool = monitoringTools.find(tool => tool.id === activeTab);
  const currentIframeState = iframeState[activeTab];

  const handleIframeLoad = () => {
    setIframeState(prev => ({ ...prev, [activeTab]: { loading: false, error: false } }));
  };

  const handleIframeError = () => {
    setIframeState(prev => ({ ...prev, [activeTab]: { loading: false, error: true } }));
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Monitoring</h2>
        <p className="text-gray-600 mt-1">
          Surveillez vos tests en temps réel avec les outils intégrés
        </p>
      </div>

      {/* Onglets */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {monitoringTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTab(tool.id)}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
              activeTab === tool.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>{tool.icon}</span>
            <span>{tool.name}</span>
          </button>
        ))}
      </div>

      {/* Contenu principal */}
      <div className="card p-0 overflow-hidden">
        {/* Barre d'outils */}
        <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
          <div>
            <h3 className="font-medium text-gray-900">{activeTool.name}</h3>
            <p className="text-sm text-gray-500">{activeTool.description}</p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIframeState(prev => ({ ...prev, [activeTab]: { loading: true, error: false } }))}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              title="Actualiser"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </button>
            
            <a
              href={activeTool.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              <span>Ouvrir</span>
            </a>
          </div>
        </div>

        {/* Zone de l'iFrame */}
        <div className="relative" style={{ height: '70vh' }}>
          
          {/* Affiche l'iframe uniquement si pas d'erreur */}
          {!currentIframeState.error && (
            <iframe
              key={activeTab} // La clé change pour forcer le rechargement
              src={activeTool.url}
              className="w-full h-full border-0"
              title={`${activeTool.name} Dashboard`}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              style={{ display: currentIframeState.loading ? 'none' : 'block' }} // Cacher pendant le chargement
            />
          )}
          
          {/* Overlay de chargement */}
          {currentIframeState.loading && (
            <div className="absolute inset-0 bg-gray-50 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Chargement de {activeTool.name}...</p>
              </div>
            </div>
          )}

          {/* Overlay d'erreur */}
          {currentIframeState.error && (
            <div className="absolute inset-0 bg-red-50 flex items-center justify-center">
                <div className="text-center text-red-700">
                    <ExclamationCircleIcon className="h-12 w-12 mx-auto mb-4"/>
                    <h4 className="font-bold">Erreur de chargement</h4>
                    <p className="text-sm">Impossible de se connecter à {activeTool.name}.</p>
                    <p className="text-xs mt-1">Vérifiez que le service est bien démarré à l'adresse <a href={activeTool.url} target="_blank" rel="noopener noreferrer" className="underline">{activeTool.url}</a></p>
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Monitoring;