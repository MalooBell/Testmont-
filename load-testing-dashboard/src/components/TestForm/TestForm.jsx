import React, { useState } from 'react';
import { 
  PlayIcon, 
  StopIcon, 
  Cog6ToothIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import LoadingSpinner from '../Common/LoadingSpinner';

const TestForm = ({ 
  onStartTest, 
  onStopTest, 
  isTestRunning, 
  isLoading,
  currentTest 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    targetUrl: 'http://localhost:8000/api',
    users: 10,
    spawnRate: 2,
    duration: 300 // 5 minutes par défaut
  });

  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    const processedValue = type === 'number' ? Number(value) : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));

    // Effacer l'erreur pour ce champ
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom du test est requis';
    }

    if (!formData.targetUrl.trim()) {
      newErrors.targetUrl = 'L\'URL cible est requise';
    } else if (!isValidUrl(formData.targetUrl)) {
      newErrors.targetUrl = 'L\'URL n\'est pas valide';
    }

    if (formData.users < 1) {
      newErrors.users = 'Le nombre d\'utilisateurs doit être supérieur à 0';
    }

    if (formData.spawnRate < 0.1) {
      newErrors.spawnRate = 'La vitesse d\'apparition doit être supérieure à 0.1';
    }

    if (formData.duration < 0) {
      newErrors.duration = 'La durée ne peut pas être négative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      onStartTest(formData);
    }
  };

  const handleStop = () => {
    onStopTest();
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Configuration du Test</h2>
          <p className="text-gray-600 mt-1">
            Configurez et lancez vos tests de charge
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Cog6ToothIcon className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-500">
            {isTestRunning ? 'Test en cours' : 'Prêt à démarrer'}
          </span>
        </div>
      </div>

      {/* Formulaire */}
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nom du test */}
            <div>
              <label htmlFor="name" className="label">
                Nom du test *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                disabled={isTestRunning}
                placeholder="Ex: Test API Production"
                className={cn(
                  'input',
                  errors.name && 'border-error-300 focus:border-error-500 focus:ring-error-500'
                )}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-error-600 flex items-center">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                  {errors.name}
                </p>
              )}
            </div>

            {/* URL cible */}
            <div>
              <label htmlFor="targetUrl" className="label">
                URL cible *
              </label>
              <input
                type="url"
                id="targetUrl"
                name="targetUrl"
                value={formData.targetUrl}
                onChange={handleInputChange}
                disabled={isTestRunning}
                placeholder="http://localhost:8000/api"
                className={cn(
                  'input',
                  errors.targetUrl && 'border-error-300 focus:border-error-500 focus:ring-error-500'
                )}
              />
              {errors.targetUrl && (
                <p className="mt-1 text-sm text-error-600 flex items-center">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                  {errors.targetUrl}
                </p>
              )}
            </div>

            {/* Nombre d'utilisateurs */}
            <div>
              <label htmlFor="users" className="label">
                Nombre d'utilisateurs
              </label>
              <input
                type="number"
                id="users"
                name="users"
                value={formData.users}
                onChange={handleInputChange}
                disabled={isTestRunning}
                min="1"
                max="10000"
                className={cn(
                  'input',
                  errors.users && 'border-error-300 focus:border-error-500 focus:ring-error-500'
                )}
              />
              {errors.users && (
                <p className="mt-1 text-sm text-error-600 flex items-center">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                  {errors.users}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Nombre d'utilisateurs simultanés à simuler
              </p>
            </div>

            {/* Vitesse d'apparition */}
            <div>
              <label htmlFor="spawnRate" className="label">
                Vitesse d'apparition (users/sec)
              </label>
              <input
                type="number"
                id="spawnRate"
                name="spawnRate"
                value={formData.spawnRate}
                onChange={handleInputChange}
                disabled={isTestRunning}
                min="0.1"
                step="0.1"
                className={cn(
                  'input',
                  errors.spawnRate && 'border-error-300 focus:border-error-500 focus:ring-error-500'
                )}
              />
              {errors.spawnRate && (
                <p className="mt-1 text-sm text-error-600 flex items-center">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                  {errors.spawnRate}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Nombre d'utilisateurs ajoutés par seconde
              </p>
            </div>

            {/* Durée */}
            <div className="md:col-span-2">
              <label htmlFor="duration" className="label">
                Durée du test (secondes)
              </label>
              <input
                type="number"
                id="duration"
                name="duration"
                value={formData.duration}
                onChange={handleInputChange}
                disabled={isTestRunning}
                min="0"
                className={cn(
                  'input',
                  errors.duration && 'border-error-300 focus:border-error-500 focus:ring-error-500'
                )}
              />
              {errors.duration && (
                <p className="mt-1 text-sm text-error-600 flex items-center">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                  {errors.duration}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Durée en secondes (0 = illimité)
              </p>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              {isTestRunning && currentTest && (
                <span>Test "{currentTest.name}" en cours...</span>
              )}
            </div>
            
            <div className="flex space-x-3">
              {isTestRunning ? (
                <button
                  type="button"
                  onClick={handleStop}
                  disabled={isLoading}
                  className="btn-danger"
                >
                  {isLoading ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <StopIcon className="h-4 w-4 mr-2" />
                  )}
                  Arrêter le test
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary"
                >
                  {isLoading ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <PlayIcon className="h-4 w-4 mr-2" />
                  )}
                  Démarrer le test
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TestForm;