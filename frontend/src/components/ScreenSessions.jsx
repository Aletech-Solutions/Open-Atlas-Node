import { useState, useEffect } from 'react';
import { Monitor, User, Clock, Circle } from 'lucide-react';
import api from '../utils/api';

export default function ScreenSessions({ machineId }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [machineId]);

  async function fetchSessions() {
    try {
      const response = await api.get(`/discovery/machines/${machineId}/screens`);
      setSessions(response.data.screens);
    } catch (error) {
      console.error('Failed to fetch screen sessions:', error);
    } finally {
      setLoading(false);
    }
  }

  function getStateColor(state) {
    switch (state?.toLowerCase()) {
      case 'attached':
        return 'text-green-600 bg-green-100';
      case 'detached':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  }

  function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Monitor className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Screen Sessions</h3>
            <p className="text-sm text-gray-600">
              {sessions.length} active {sessions.length === 1 ? 'session' : 'sessions'}
            </p>
          </div>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Monitor className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No active screen sessions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="font-mono font-semibold text-gray-900">
                      {session.screen_id}
                    </span>
                    {session.name && (
                      <span className="text-sm text-gray-600">
                        · {session.name}
                      </span>
                    )}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStateColor(session.state)}`}>
                      <Circle className="w-2 h-2 mr-1 fill-current" />
                      {session.state || 'unknown'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    {session.owner_user && (
                      <div className="flex items-center space-x-1">
                        <User className="w-4 h-4" />
                        <span>{session.owner_user}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>Last seen {formatTimestamp(session.last_seen)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

