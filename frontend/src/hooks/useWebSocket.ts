import { useEffect, useState } from 'react';
import { wsService } from '../services/websocket';
import { ProcessedMessage, AggregatedMetrics } from '../types';

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<ProcessedMessage | null>(null);
  const [metrics, setMetrics] = useState<AggregatedMetrics | null>(null);

  useEffect(() => {
    wsService.connect();

    const interval = setInterval(() => {
      setIsConnected(wsService.isConnected());
    }, 1000);

    const unsubscribeMessage = wsService.onMessage((message) => {
      setLastMessage(message);
    });

    const unsubscribeMetrics = wsService.onMetrics((metrics) => {
      setMetrics(metrics);
    });

    return () => {
      clearInterval(interval);
      unsubscribeMessage();
      unsubscribeMetrics();
    };
  }, []);

  return { isConnected, lastMessage, metrics };
}
