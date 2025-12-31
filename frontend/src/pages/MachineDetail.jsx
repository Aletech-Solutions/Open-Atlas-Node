import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import {
  ArrowLeft,
  Server,
  Cpu,
  HardDrive,
  Network,
  Power,
  RefreshCw,
  Terminal as TerminalIcon,
  Trash2
} from 'lucide-react';
import Terminal from '../components/Terminal';
import SystemMetrics from '../components/SystemMetrics';
import ScreenSessions from '../components/ScreenSessions';
import OpenPorts from '../components/OpenPorts';

export default function MachineDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [machine, setMachine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTerminal, setShowTerminal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchMachine();
    const interval = setInterval(fetchMachine, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [id]);

  async function fetchMachine() {
    try {
      const response = await api.get(`/machines/${id}`);
      setMachine(response.data.machine);
    } catch (error) {
      console.error('Failed to fetch machine:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action) {
    if (!confirm(`Are you sure you want to ${action} this machine?`)) {
      return;
    }

    setActionLoading(true);
    try {
      await api.post(`/machines/${id}/action`, { action });
      console.log(`Action ${action} executed successfully`);
    } catch (error) {
      console.error('Action failed:', error);
      alert(error.response?.data?.error || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this machine? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/machines/${id}`);
      navigate('/');
    } catch (error) {
      console.error('Delete failed:', error);
      alert(error.response?.data?.error || 'Delete failed');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!machine) {
    return (
      <div className="text-center py-12">
        <Server className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Machine not found</h3>
        <Link to="/" className="btn-primary mt-4">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Link to="/" className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{machine.name}</h1>
            <p className="text-gray-600 mt-1">{machine.hostname}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {machine.status === 'online' && user?.role === 'admin' && (
            <>
              <button
                onClick={() => setShowTerminal(!showTerminal)}
                className="btn-secondary flex items-center space-x-2"
              >
                <TerminalIcon className="w-4 h-4" />
                <span>{showTerminal ? 'Hide' : 'Show'} Terminal</span>
              </button>

              <button
                onClick={() => handleAction('reboot')}
                disabled={actionLoading}
                className="btn-secondary flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reboot</span>
              </button>

              <button
                onClick={() => handleAction('shutdown')}
                disabled={actionLoading}
                className="btn-danger flex items-center space-x-2"
              >
                <Power className="w-4 h-4" />
                <span>Shutdown</span>
              </button>
            </>
          )}

          {user?.role === 'admin' && (
            <button
              onClick={handleDelete}
              className="btn-danger flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Terminal */}
      {showTerminal && machine.status === 'online' && (
        <div className="mb-8">
          <Terminal machineId={machine.id} />
        </div>
      )}

      {/* System Specifications */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">System Specifications</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Connection Info */}
          <div className="card">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Server className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Connection</h3>
            </div>
            <dl className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <dt className="text-sm font-medium text-gray-600">Status</dt>
                <dd className="flex items-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    machine.status === 'online' ? 'bg-green-100 text-green-800' :
                    machine.status === 'offline' ? 'bg-gray-100 text-gray-800' :
                    machine.status === 'installing' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {machine.status.toUpperCase()}
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <dt className="text-sm font-medium text-gray-600">IP Address</dt>
                <dd className="text-sm font-mono text-gray-900">{machine.ip_address}</dd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <dt className="text-sm font-medium text-gray-600">SSH Port</dt>
                <dd className="text-sm font-mono text-gray-900">{machine.ssh_port}</dd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <dt className="text-sm font-medium text-gray-600">Agent Port</dt>
                <dd className="text-sm font-mono text-gray-900">{machine.agent_port || 7777}</dd>
              </div>
              {machine.last_seen && (
                <div className="flex items-center justify-between py-2">
                  <dt className="text-sm font-medium text-gray-600">Last Seen</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(machine.last_seen).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Operating System */}
          {machine.os_info && (
            <div className="card">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Server className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Operating System</h3>
              </div>
              <dl className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <dt className="text-sm font-medium text-gray-600">Platform</dt>
                  <dd className="text-sm font-medium text-gray-900">{machine.os_info.platform}</dd>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <dt className="text-sm font-medium text-gray-600">Distribution</dt>
                  <dd className="text-sm font-medium text-gray-900">{machine.os_info.distro}</dd>
                </div>
                {machine.os_info.release && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <dt className="text-sm font-medium text-gray-600">Release</dt>
                    <dd className="text-sm font-medium text-gray-900">{machine.os_info.release}</dd>
                  </div>
                )}
                {machine.os_info.kernel && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <dt className="text-sm font-medium text-gray-600">Kernel</dt>
                    <dd className="text-sm font-mono text-gray-900">{machine.os_info.kernel}</dd>
                  </div>
                )}
                {machine.os_info.arch && (
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-sm font-medium text-gray-600">Architecture</dt>
                    <dd className="text-sm font-mono text-gray-900">{machine.os_info.arch}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>

        {/* Hardware Specifications */}
        {machine.hardware_info && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CPU */}
            {machine.hardware_info.cpu && (
              <div className="card">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Cpu className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Processor</h3>
                </div>
                <dl className="space-y-3">
                  <div className="py-2 border-b border-gray-100">
                    <dt className="text-xs font-medium text-gray-500 mb-1">Model</dt>
                    <dd className="text-sm font-medium text-gray-900 leading-tight">
                      {machine.hardware_info.cpu.brand}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <dt className="text-sm font-medium text-gray-600">Physical Cores</dt>
                    <dd className="text-sm font-bold text-gray-900">
                      {machine.hardware_info.cpu.physicalCores || machine.hardware_info.cpu.cores}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <dt className="text-sm font-medium text-gray-600">Logical Cores</dt>
                    <dd className="text-sm font-bold text-gray-900">
                      {machine.hardware_info.cpu.cores}
                    </dd>
                  </div>
                  {machine.hardware_info.cpu.speed && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <dt className="text-sm font-medium text-gray-600">Base Speed</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {machine.hardware_info.cpu.speed} GHz
                      </dd>
                    </div>
                  )}
                  {machine.hardware_info.cpu.speedMax && (
                    <div className="flex items-center justify-between py-2">
                      <dt className="text-sm font-medium text-gray-600">Max Speed</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {machine.hardware_info.cpu.speedMax} GHz
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Memory */}
            {machine.hardware_info.memory && (
              <div className="card">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <HardDrive className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Memory (RAM)</h3>
                </div>
                <dl className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <dt className="text-sm font-medium text-gray-600">Total</dt>
                    <dd className="text-sm font-bold text-gray-900">
                      {(machine.hardware_info.memory.total / 1024 / 1024 / 1024).toFixed(2)} GB
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <dt className="text-sm font-medium text-gray-600">Used</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {(machine.hardware_info.memory.used / 1024 / 1024 / 1024).toFixed(2)} GB
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <dt className="text-sm font-medium text-gray-600">Free</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {(machine.hardware_info.memory.free / 1024 / 1024 / 1024).toFixed(2)} GB
                    </dd>
                  </div>
                  <div className="py-2">
                    <dt className="text-xs font-medium text-gray-500 mb-2">Usage</dt>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${((machine.hardware_info.memory.used / machine.hardware_info.memory.total) * 100).toFixed(1)}%` 
                        }}
                      ></div>
                    </div>
                    <dd className="text-xs text-gray-600 mt-1 text-right">
                      {((machine.hardware_info.memory.used / machine.hardware_info.memory.total) * 100).toFixed(1)}%
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {/* GPU or Additional Info */}
            <div className="card">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Network className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Additional Info</h3>
              </div>
              <dl className="space-y-3">
                {machine.created_at && (
                  <div className="py-2 border-b border-gray-100">
                    <dt className="text-xs font-medium text-gray-500 mb-1">Added to System</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {new Date(machine.created_at).toLocaleString()}
                    </dd>
                  </div>
                )}
                {machine.added_by_username && (
                  <div className="py-2 border-b border-gray-100">
                    <dt className="text-xs font-medium text-gray-500 mb-1">Added By</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {machine.added_by_username}
                    </dd>
                  </div>
                )}
                {machine.hardware_info?.gpu && (
                  <div className="py-2">
                    <dt className="text-xs font-medium text-gray-500 mb-1">Graphics</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {machine.hardware_info.gpu.model || machine.hardware_info.gpu.vendor}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        )}
      </div>

      {/* Metrics */}
      {machine.status === 'online' && (
        <SystemMetrics machineId={machine.id} />
      )}

      {/* Discovery: Screen Sessions and Open Ports */}
      {machine.status === 'online' && (
        <div className="space-y-6 mt-8">
          <h2 className="text-2xl font-bold text-gray-900">Discovery & Monitoring</h2>
          
          <div className="grid grid-cols-1 gap-6">
            <OpenPorts machineId={machine.id} />
            <ScreenSessions machineId={machine.id} />
          </div>
        </div>
      )}
    </div>
  );
}

