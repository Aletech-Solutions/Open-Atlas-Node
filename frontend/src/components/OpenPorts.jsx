import { useState, useEffect } from 'react';
import { Network, Tag, Edit2, Check, X, User, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

export default function OpenPorts({ machineId }) {
  const { user } = useAuth();
  const [ports, setPorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPort, setEditingPort] = useState(null);
  const [editLabel, setEditLabel] = useState('');

  useEffect(() => {
    fetchPorts();
    const interval = setInterval(fetchPorts, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [machineId]);

  async function fetchPorts() {
    try {
      const response = await api.get(`/discovery/machines/${machineId}/ports`);
      setPorts(response.data.ports);
    } catch (error) {
      console.error('Failed to fetch open ports:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveLabel(port) {
    try {
      const label = editLabel.trim();
      
      if (label === '') {
        // Delete label if empty
        await api.delete(`/discovery/machines/${machineId}/ports/${port}/label`);
      } else {
        // Save label
        await api.post(`/discovery/machines/${machineId}/ports/${port}/label`, { label });
      }
      
      await fetchPorts();
      setEditingPort(null);
      setEditLabel('');
    } catch (error) {
      console.error('Failed to save port label:', error);
      alert('Failed to save label');
    }
  }

  function startEditing(port, currentLabel) {
    setEditingPort(port);
    setEditLabel(currentLabel || '');
  }

  function cancelEditing() {
    setEditingPort(null);
    setEditLabel('');
  }

  function getProtocolColor(protocol) {
    return protocol === 'tcp' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  }

  function getWellKnownServiceName(port) {
    const services = {
      20: 'FTP Data',
      21: 'FTP',
      22: 'SSH',
      23: 'Telnet',
      25: 'SMTP',
      53: 'DNS',
      80: 'HTTP',
      110: 'POP3',
      143: 'IMAP',
      443: 'HTTPS',
      465: 'SMTPS',
      587: 'SMTP Submission',
      993: 'IMAPS',
      995: 'POP3S',
      3306: 'MySQL',
      5432: 'PostgreSQL',
      6379: 'Redis',
      8080: 'HTTP Alt',
      8443: 'HTTPS Alt',
      27017: 'MongoDB',
      3000: 'Development',
      5000: 'Development',
      9000: 'Development'
    };
    return services[port] || null;
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
          <div className="p-2 bg-blue-100 rounded-lg">
            <Network className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Open Ports</h3>
            <p className="text-sm text-gray-600">
              {ports.length} listening {ports.length === 1 ? 'port' : 'ports'}
            </p>
          </div>
        </div>
      </div>

      {ports.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Network className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No open ports detected</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Port
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Protocol
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Label
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Process
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Address
                </th>
                {user?.role === 'admin' && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {ports.map((port) => {
                const isEditing = editingPort === port.port;
                const wellKnownService = getWellKnownServiceName(port.port);

                return (
                  <tr key={port.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono font-semibold text-gray-900">
                        {port.port}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${getProtocolColor(port.protocol)}`}>
                        {port.protocol.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="e.g., API Server"
                            autoFocus
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') saveLabel(port.port);
                              if (e.key === 'Escape') cancelEditing();
                            }}
                          />
                          <button
                            onClick={() => saveLabel(port.port)}
                            className="p-1 text-green-600 hover:bg-green-100 rounded"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          {port.label ? (
                            <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
                              <Tag className="w-3 h-3 mr-1" />
                              {port.label}
                            </span>
                          ) : wellKnownService ? (
                            <span className="text-sm text-gray-500 italic">
                              {wellKnownService}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Activity className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{port.process || 'N/A'}</span>
                        {port.pid && (
                          <span className="text-xs text-gray-500">({port.pid})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{port.owner_user || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm font-mono text-gray-600">{port.address}</span>
                    </td>
                    {user?.role === 'admin' && (
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {!isEditing && (
                          <button
                            onClick={() => startEditing(port.port, port.label)}
                            className="inline-flex items-center px-2 py-1 text-xs text-primary-600 hover:bg-primary-100 rounded transition-colors"
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            Label
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

