import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import { Cpu, HardDrive, Network, Activity } from 'lucide-react';

export default function SystemMetrics({ machineId }) {
  const [metrics, setMetrics] = useState({
    cpu: [],
    memory: [],
    disk: [],
    network: []
  });
  const [currentMetrics, setCurrentMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchCurrentMetrics, 5000); // Update every 5s
    return () => clearInterval(interval);
  }, [machineId]);

  async function fetchMetrics() {
    try {
      const response = await api.get(`/machines/${machineId}/metrics`, {
        params: { limit: 50 }
      });
      
      const data = response.data.metrics;
      
      // Group metrics by type
      const grouped = {
        cpu: data.filter(m => m.metric_type === 'cpu'),
        memory: data.filter(m => m.metric_type === 'memory'),
        disk: data.filter(m => m.metric_type === 'disk'),
        network: data.filter(m => m.metric_type === 'network')
      };

      setMetrics(grouped);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCurrentMetrics() {
    try {
      const response = await api.post(`/machines/${machineId}/action`, {
        action: 'get_info'
      });
      setCurrentMetrics(response.data);
    } catch (error) {
      console.error('Failed to fetch current metrics:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">System Metrics</h2>

      {/* Current Metrics */}
      {currentMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">CPU Load</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {currentMetrics.cpu?.load !== undefined
                    ? currentMetrics.cpu.load.toFixed(1)
                    : '0'}%
                </p>
              </div>
              <Cpu className="w-10 h-10 text-primary-600" />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Memory Used</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {currentMetrics.memory?.used && currentMetrics.memory?.total
                    ? ((currentMetrics.memory.used / currentMetrics.memory.total) * 100).toFixed(1)
                    : '0'}%
                </p>
              </div>
              <HardDrive className="w-10 h-10 text-primary-600" />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Disk Used</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {currentMetrics.disk?.[0]?.use !== undefined
                    ? currentMetrics.disk[0].use.toFixed(1)
                    : '0'}%
                </p>
              </div>
              <Activity className="w-10 h-10 text-primary-600" />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Network</p>
                <p className="text-lg font-bold text-gray-900 mt-1">Active</p>
              </div>
              <Network className="w-10 h-10 text-primary-600" />
            </div>
          </div>
        </div>
      )}

      {/* Historical Charts */}
      {metrics.cpu.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">CPU Usage History</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.cpu.map(m => ({
              time: new Date(m.timestamp).toLocaleTimeString(),
              value: m.metric_data.load
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#0ea5e9" name="CPU %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {metrics.memory.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Memory Usage History</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.memory.map(m => ({
              time: new Date(m.timestamp).toLocaleTimeString(),
              value: parseFloat(m.metric_data.usedPercent)
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#10b981" name="Memory %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

