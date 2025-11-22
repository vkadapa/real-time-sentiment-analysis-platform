import { io, Socket } from 'socket.io-client';
import { ProcessedMessage, AggregatedMetrics } from '../types';

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';

export class WebSocketService {
  private socket: Socket | null = null;
  private messageCallbacks: ((message: ProcessedMessage) => void)[] = [];
  private metricsCallbacks: ((metrics: AggregatedMetrics) => void)[] = [];
  private churnAlertCallbacks: ((alert: any) => void)[] = [];

  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(WS_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('message:new', (message: ProcessedMessage) => {
      this.messageCallbacks.forEach(cb => cb(message));
    });

    this.socket.on('metrics:initial', (metrics: AggregatedMetrics) => {
      this.metricsCallbacks.forEach(cb => cb(metrics));
    });

    this.socket.on('metrics:update', (metrics: AggregatedMetrics) => {
      this.metricsCallbacks.forEach(cb => cb(metrics));
    });

    this.socket.on('alert:churn', (alert: any) => {
      this.churnAlertCallbacks.forEach(cb => cb(alert));
    });

    this.socket.on('error', (error: any) => {
      console.error('WebSocket error:', error);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  onMessage(callback: (message: ProcessedMessage) => void): () => void {
    this.messageCallbacks.push(callback);
    return () => {
      this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== callback);
    };
  }

  onMetrics(callback: (metrics: AggregatedMetrics) => void): () => void {
    this.metricsCallbacks.push(callback);
    return () => {
      this.metricsCallbacks = this.metricsCallbacks.filter(cb => cb !== callback);
    };
  }

  onChurnAlert(callback: (alert: any) => void): () => void {
    this.churnAlertCallbacks.push(callback);
    return () => {
      this.churnAlertCallbacks = this.churnAlertCallbacks.filter(cb => cb !== callback);
    };
  }

  requestMetrics(type: string, key: string | null): void {
    if (this.socket?.connected) {
      this.socket.emit('request:metrics', { type, key });
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const wsService = new WebSocketService();
