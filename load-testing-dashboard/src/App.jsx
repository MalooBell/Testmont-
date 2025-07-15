import React, { useState, useEffect } from 'react';
import Layout from './components/Layout/Layout';
import TestForm from './components/TestForm/TestForm';
import TestMetrics from './components/TestMetrics/TestMetrics';
import TestHistory from './components/TestHistory/TestHistory';
import Monitoring from './components/Monitoring/Monitoring';
import Visualization from './components/Visualization/Visualization';
import { testService } from './services/api';
import { useWebSocket, useWebSocketConnection } from './hooks/useWebSocket';

function App() {
  const [currentTab, setCurrentTab] = useState('new-test');
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState(null);
  const [testStats, setTestStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Connexion WebSocket
  useWebSocketConnection();

  // Écouter les événements WebSocket
  useWebSocket('test_started', (data) => {
    setIsTestRunning(true);
    setCurrentTest({ id: data.testId, name: data.name });
  });

  useWebSocket('test_stopped', () => {
    setIsTestRunning(false);
    setCurrentTest(null);
    setTestStats(null);
  });

  useWebSocket('test_completed', () => {
    setIsTestRunning(false);
    setCurrentTest(null);
    setTestStats(null);
  });

  useWebSocket('stats_update', (data) => {
    setTestStats(data.stats);
  });

  // Charger le statut initial
  useEffect(() => {
    loadCurrentTestStatus();
  }, []);

  const loadCurrentTestStatus = async () => {
    try {
      const status = await testService.getCurrentTest();
      setIsTestRunning(status.running);
      
      if (status.running) {
        setCurrentTest({ id: status.testId });
        setTestStats(status.stats);
      }
    } catch (error) {
      console.error('Erreur chargement statut:', error);
    }
  };

  const handleStartTest = async (testConfig) => {
    try {
      setIsLoading(true);
      const result = await testService.startTest(testConfig);
      
      if (result.success) {
        setIsTestRunning(true);
        setCurrentTest({ id: result.testId, name: testConfig.name });
      }
    } catch (error) {
      console.error('Erreur démarrage test:', error);
      alert('Erreur lors du démarrage du test. Vérifiez que le backend est démarré.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopTest = async () => {
    try {
      setIsLoading(true);
      await testService.stopTest();
      
      setIsTestRunning(false);
      setCurrentTest(null);
      setTestStats(null);
    } catch (error) {
      console.error('Erreur arrêt test:', error);
      alert('Erreur lors de l\'arrêt du test.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderCurrentTab = () => {
    switch (currentTab) {
      case 'new-test':
        return (
          <div className="space-y-8">
            <TestForm
              onStartTest={handleStartTest}
              onStopTest={handleStopTest}
              isTestRunning={isTestRunning}
              isLoading={isLoading}
              currentTest={currentTest}
            />
            
            {isTestRunning && (
              <TestMetrics 
                stats={testStats} 
                loading={!testStats}
              />
            )}
          </div>
        );
      
      case 'monitoring':
        return <Monitoring />;
      
      case 'visualization':
        return <Visualization />;
      
      case 'history':
        return (
          <TestHistory 
            onNavigateToVisualization={() => setCurrentTab('visualization')}
            isTestRunning={isTestRunning}
          />
        );
      
      default:
        return <div>Onglet non trouvé</div>;
    }
  };

  return (
    <Layout
      currentTab={currentTab}
      onTabChange={setCurrentTab}
      isTestRunning={isTestRunning}
    >
      {renderCurrentTab()}
    </Layout>
  );
}

export default App;