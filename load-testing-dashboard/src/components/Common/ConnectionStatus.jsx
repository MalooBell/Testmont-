import React, { useState, useEffect } from 'react';
import { 
  WifiIcon, 
  ExclamationTriangleIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline';
import { useWebSocket } from '../../hooks/useWebSocket';
import { cn } from '../../utils/cn';

const ConnectionStatus = () => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isVisible, setIsVisible] = useState(false);

  useWebSocket('connection', (data) => {
    setConnectionStatus(data.status);
    setIsVisible(data.status !== 'connected');
  });

  useEffect(() => {
    // Masquer automatiquement après 5 secondes si connecté
    if (connectionStatus === 'connected') {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [connectionStatus]);

  if (!isVisible) return null;

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          icon: WifiIcon,
          message: 'Connexion WebSocket établie',
          bgColor: 'bg-success-50',
          textColor: 'text-success-800',
          iconColor: 'text-success-600',
          borderColor: 'border-success-200'
        };
      case 'disconnected':
        return {
          icon: ExclamationTriangleIcon,
          message: 'Connexion WebSocket perdue - Tentative de reconnexion...',
          bgColor: 'bg-warning-50',
          textColor: 'text-warning-800',
          iconColor: 'text-warning-600',
          borderColor: 'border-warning-200'
        };
      case 'failed':
        return {
          icon: ExclamationTriangleIcon,
          message: 'Impossible de se connecter au serveur',
          bgColor: 'bg-error-50',
          textColor: 'text-error-800',
          iconColor: 'text-error-600',
          borderColor: 'border-error-200'
        };
      default:
        return {
          icon: ExclamationTriangleIcon,
          message: 'Statut de connexion inconnu',
          bgColor: 'bg-gray-50',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-600',
          borderColor: 'border-gray-200'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={cn(
        'flex items-center space-x-3 px-4 py-3 rounded-lg border shadow-lg max-w-sm',
        config.bgColor,
        config.textColor,
        config.borderColor
      )}>
        <Icon className={cn('h-5 w-5 flex-shrink-0', config.iconColor)} />
        <p className="text-sm font-medium flex-1">{config.message}</p>
        <button
          onClick={() => setIsVisible(false)}
          className={cn('p-1 rounded hover:bg-black hover:bg-opacity-10', config.textColor)}
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default ConnectionStatus;