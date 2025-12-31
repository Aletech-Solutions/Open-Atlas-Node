import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import api from '../utils/api';
import { 
  Server, 
  Plus, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Clock,
  Cpu,
  HardDrive,
  Activity,
  Bug
} from 'lucide-react';
import AddMachineModal from '../components/AddMachineModal';
import MachineDebugModal from '../components/MachineDebugModal';

export default function Dashboard() {
  const { user } = useAuth();
  const { machines: wsMachines } = useWebSocket();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [debugMachine, setDebugMachine] = useState(null);

  useEffect(() => {
    fetchMachines();
  }, []);

  useEffect(() => {
    // Update machines with WebSocket data
    if (Object.keys(wsMachines).length > 0) {
      setMachines(prev => 
        prev.map(machine => ({
          ...machine,
          ...(wsMachines[machine.id] || {})
        }))
      );
    }
  }, [wsMachines]);

  async function fetchMachines() {
    try {
      const response = await api.get('/machines');
      setMachines(response.data.machines);
    } catch (error) {
      console.error('Failed to fetch machines:', error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'online':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'offline':
        return <XCircle className="w-5 h-5 text-gray-400" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'installing':
        return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />;
      default:
        return <XCircle className="w-5 h-5 text-gray-400" />;
    }
  }

  function getStatusBadge(status) {
    const badges = {
      online: 'badge-success',
      offline: 'badge-danger',
      error: 'badge-danger',
      installing: 'badge-warning'
    };
    return badges[status] || 'badge-info';
  }

  const stats = {
    total: machines.length,
    online: machines.filter(m => m.status === 'online').length,
    offline: machines.filter(m => m.status === 'offline').length,
    error: machines.filter(m => m.status === 'error').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage your homelab infrastructure</p>
        </div>

        {user?.role === 'admin' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Add Machine</span>
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Machines</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <Server className="w-12 h-12 text-gray-400" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Online</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{stats.online}</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-400" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Offline</p>
              <p className="text-3xl font-bold text-gray-600 mt-1">{stats.offline}</p>
            </div>
            <XCircle className="w-12 h-12 text-gray-400" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Errors</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{stats.error}</p>
            </div>
            <AlertCircle className="w-12 h-12 text-red-400" />
          </div>
        </div>
      </div>

      {/* Machines List */}
      {machines.length === 0 ? (
        <div className="card text-center py-12">
          <Server className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No machines yet</h3>
          <p className="text-gray-600 mb-6">
            Add your first machine to start monitoring your homelab
          </p>
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary"
            >
              Add Machine
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {machines.map((machine) => (
            <div key={machine.id} className="card hover:shadow-md transition-shadow relative">
              <Link
                to={`/machines/${machine.id}`}
                className="block"
              >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(machine.status)}
                  <div>
                    <h3 className="font-semibold text-gray-900">{machine.name}</h3>
                    <p className="text-sm text-gray-500">{machine.hostname}</p>
                  </div>
                </div>
                <span className={`badge ${getStatusBadge(machine.status)}`}>
                  {machine.status}
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4" />
                  <span>{machine.ip_address}:{machine.agent_port || 7777}</span>
                </div>

                {machine.os_info && (
                  <div className="flex items-center space-x-2">
                    <Server className="w-4 h-4" />
                    <span>
                      {machine.os_info.platform} {machine.os_info.distro}
                    </span>
                  </div>
                )}

                {machine.metrics && (
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center space-x-2">
                      <Cpu className="w-4 h-4 text-primary-600" />
                      <span className="text-xs">
                        CPU: {machine.metrics.cpu?.load?.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <HardDrive className="w-4 h-4 text-primary-600" />
                      <span className="text-xs">
                        RAM: {machine.metrics.memory?.usedPercent}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {machine.last_seen && (
                <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
                  Last seen: {new Date(machine.last_seen).toLocaleString()}
                </div>
              )}
              </Link>
              
              {/* Debug Button for Error or Installing Status */}
              {(machine.status === 'error' || machine.status === 'installing') && user?.role === 'admin' && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setDebugMachine(machine);
                  }}
                  className={`absolute bottom-4 right-4 p-2 ${
                    machine.status === 'error' 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-yellow-600 hover:bg-yellow-700'
                  } text-white rounded-full transition-colors shadow-lg`}
                  title={machine.status === 'installing' ? 'View Installation Progress' : 'Debug Information'}
                >
                  {machine.status === 'installing' ? (
                    <Clock className="w-4 h-4 animate-pulse" />
                  ) : (
                    <Bug className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Machine Modal */}
      {showAddModal && (
        <AddMachineModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchMachines();
          }}
        />
      )}

      {/* Debug Modal */}
      {debugMachine && (
        <MachineDebugModal
          machine={debugMachine}
          onClose={() => setDebugMachine(null)}
        />
      )}
    </div>
  );
}

