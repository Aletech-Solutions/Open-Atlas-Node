import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext();

export function useWebSocket() {
  return useContext(WebSocketContext);
}

export function WebSocketProvider({ children }) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [machines, setMachines] = useState({});
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user]);

  function connect() {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    console.log('Connecting to WebSocket:', wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);

      // Authenticate
      const token = localStorage.getItem('token');
      if (token) {
        ws.send(JSON.stringify({ type: 'auth', token }));
      }

      // Start heartbeat
      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);

      ws.heartbeatInterval = heartbeat;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);

      if (ws.heartbeatInterval) {
        clearInterval(ws.heartbeatInterval);
      }

      // Attempt reconnection
      if (user) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 5000);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  function disconnect() {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      if (wsRef.current.heartbeatInterval) {
        clearInterval(wsRef.current.heartbeatInterval);
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnected(false);
  }

  function handleMessage(data) {
    console.log('WebSocket message:', data);

    switch (data.type) {
      case 'auth_success':
        console.log('WebSocket authenticated');
        break;

      case 'machine_status':
        setMachines(prev => ({
          ...prev,
          [data.machineId]: {
            ...prev[data.machineId],
            status: data.status,
            lastUpdate: data.timestamp
          }
        }));
        break;

      case 'machine_metrics':
        setMachines(prev => ({
          ...prev,
          [data.machineId]: {
            ...prev[data.machineId],
            metrics: data.metrics,
            lastUpdate: data.timestamp
          }
        }));
        break;

      case 'pong':
        // Heartbeat response
        break;

      case 'error':
        console.error('WebSocket error:', data.message);
        break;

      default:
        console.warn('Unknown message type:', data.type);
    }
  }

  const value = {
    connected,
    machines
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

