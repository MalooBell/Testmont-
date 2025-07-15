import { useEffect, useCallback } from 'react';
import websocketService from '../services/websocket';

export const useWebSocket = (eventType, callback, dependencies = []) => {
  const memoizedCallback = useCallback(callback, dependencies);

  useEffect(() => {
    const unsubscribe = websocketService.subscribe(eventType, memoizedCallback);
    return unsubscribe;
  }, [eventType, memoizedCallback]);
};

export const useWebSocketConnection = () => {
  useEffect(() => {
    websocketService.connect();
    
    return () => {
      websocketService.disconnect();
    };
  }, []);

  return {
    isConnected: websocketService.isConnected(),
    disconnect: websocketService.disconnect.bind(websocketService),
  };
};