import axios from 'axios';

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api`;

// Configuration axios
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Services API
export const testService = {
  // Démarrer un nouveau test
  startTest: async (testConfig) => {
    const response = await api.post('/tests/start', testConfig);
    return response.data;
  },

  // Arrêter le test en cours
  stopTest: async () => {
    const response = await api.post('/tests/stop');
    return response.data;
  },

  // Obtenir le statut du test actuel
  getCurrentTest: async () => {
    const response = await api.get('/tests/current');
    return response.data;
  },

  // Obtenir l'historique des tests
  getTestHistory: async () => {
    const response = await api.get('/tests/history');
    return response.data;
  },

  // Obtenir les détails d'un test spécifique
  getTestDetails: async (testId) => {
    const response = await api.get(`/tests/${testId}`);
    return response.data;
  },
};

// Service pour les métriques Prometheus
export const metricsService = {
  // Obtenir les métriques système
  getSystemMetrics: async () => {
    try {
      const response = await axios.get('http://localhost:9090/api/v1/query', {
        params: {
          query: 'up'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur récupération métriques Prometheus:', error);
      return null;
    }
  },

   /**
   * Exécute une requête PromQL via le backend.
   * @param {string} query - La requête PromQL.
   * @returns {Promise<object>}
   */
  query: async (query) => {
    const response = await api.get('/metrics/query', {
      params: { query },
    });
    return response.data;
  },

  // Obtenir les métriques Locust
  getLocustMetrics: async () => {
    try {
      const response = await axios.get('http://localhost:8089/stats/requests');
      return response.data;
    } catch (error) {
      console.error('Erreur récupération métriques Locust:', error);
      return null;
    }
  },
};

export default api;