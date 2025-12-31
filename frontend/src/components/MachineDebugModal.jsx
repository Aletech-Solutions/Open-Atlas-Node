import { useState, useEffect } from 'react';
import { X, AlertCircle, Clock, Terminal, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import api from '../utils/api';

export default function MachineDebugModal({ machine, onClose }) {
  const [debugInfo, setDebugInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDebugInfo();
    
    // Auto-refresh if installing
    if (machine.status === 'installing') {
      const interval = setInterval(() => {
        fetchDebugInfo();
      }, 3000); // Refresh every 3 seconds
      
      return () => clearInterval(interval);
    }
  }, [machine.id, machine.status]);

  async function fetchDebugInfo() {
    try {
      const response = await api.get(`/machines/${machine.id}/debug`);
      setDebugInfo(response.data);
    } catch (error) {
      console.error('Failed to fetch debug info:', error);
    } finally {
      setLoading(false);
    }
  }

  const getActionIcon = (action) => {
    if (action.includes('add')) return '➕';
    if (action.includes('delete')) return '🗑️';
    if (action.includes('action')) return '⚡';
    if (action.includes('terminal')) return '💻';
    return '📝';
  };

  const getActionColor = (action) => {
    if (action.includes('error') || action.includes('fail')) return 'text-red-600';
    if (action.includes('success') || action.includes('online')) return 'text-green-600';
    if (action.includes('installing')) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b border-gray-200 ${
          machine.status === 'installing' ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : ''
        }`}>
          <div className="flex items-center space-x-3">
            {machine.status === 'installing' ? (
              <Loader2 className="w-6 h-6 text-yellow-600 animate-spin" />
            ) : machine.status === 'error' ? (
              <AlertCircle className="w-6 h-6 text-red-600" />
            ) : (
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {machine.status === 'installing' ? '⚙️ Installation Progress' : '🔍 Debug Information'}
              </h2>
              <p className="text-sm text-gray-600">{machine.name} - {machine.hostname}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : debugInfo ? (
            <div className="space-y-6">
              {/* Installation Summary (when installing) */}
              {machine.status === 'installing' && debugInfo.installation_logs && (
                <div className="bg-gradient-to-r from-yellow-100 via-orange-100 to-yellow-100 border-2 border-yellow-300 rounded-lg p-5 shadow-md">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="relative">
                        <Loader2 className="w-12 h-12 text-yellow-600 animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-6 h-6 bg-yellow-400 rounded-full animate-ping opacity-75"></div>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        Installing Agent on {machine.name}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span className="text-green-900 font-medium">
                            {debugInfo.installation_logs.filter(l => l.success).length} completed
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-red-900 font-medium">
                            {debugInfo.installation_logs.filter(l => !l.success).length} failed
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-gray-600" />
                          <span className="text-gray-900">
                            {debugInfo.installation_logs.length} total steps
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Machine Status */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Machine Status</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <span className={`ml-2 font-medium ${
                      debugInfo.machine.status === 'error' ? 'text-red-600' :
                      debugInfo.machine.status === 'online' ? 'text-green-600' :
                      'text-gray-600'
                    }`}>
                      {debugInfo.machine.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">IP Address:</span>
                    <span className="ml-2 font-mono">{debugInfo.machine.ip_address}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">SSH Port:</span>
                    <span className="ml-2 font-mono">{debugInfo.machine.ssh_port}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Agent Port:</span>
                    <span className="ml-2 font-mono">{debugInfo.machine.agent_port || 7777}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Has Agent Data:</span>
                    <span className={`ml-2 font-medium ${
                      debugInfo.has_agent_data ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {debugInfo.has_agent_data ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Last Seen:</span>
                    <span className="ml-2">
                      {debugInfo.machine.last_seen 
                        ? new Date(debugInfo.machine.last_seen).toLocaleString()
                        : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Common Issues */}
              {debugInfo.machine.status === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 mb-2">Common Issues to Check:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                    <li>Verify SSH credentials are correct</li>
                    <li>Check if target machine is reachable: <code className="bg-red-100 px-1 rounded">ping {debugInfo.machine.ip_address}</code></li>
                    <li>Verify SSH port is open: <code className="bg-red-100 px-1 rounded">telnet {debugInfo.machine.ip_address} {debugInfo.machine.ssh_port}</code></li>
                    <li>Check if user has sudo privileges</li>
                    <li>Verify firewall allows connections</li>
                    {!debugInfo.has_agent_data && <li>Agent may have failed to install - check SSH logs</li>}
                  </ul>
                </div>
              )}

              {/* Installation Logs */}
              {debugInfo.installation_logs && debugInfo.installation_logs.length > 0 && (
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {machine.status === 'installing' ? '⚙️ Installation in Progress' : '📋 Installation Logs'}
                    </h3>
                    {machine.status === 'installing' && (
                      <div className="flex items-center space-x-2 text-sm text-yellow-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Live updating...</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    {debugInfo.installation_logs.map((log, index) => (
                      <div
                        key={index}
                        className={`rounded-lg border-2 transition-all ${
                          log.success 
                            ? 'border-green-300 bg-gradient-to-r from-green-50 to-green-100' 
                            : 'border-red-300 bg-gradient-to-r from-red-50 to-red-100'
                        }`}
                      >
                        <div className="flex items-start space-x-3 p-3">
                          <div className={`flex-shrink-0 mt-0.5 ${
                            log.success ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {log.success ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : (
                              <XCircle className="w-5 h-5" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`font-semibold text-sm ${
                                log.success ? 'text-green-900' : 'text-red-900'
                              }`}>
                                {log.stage.replace(/_/g, ' ').toUpperCase()}
                              </span>
                              <span className="text-xs text-gray-600 flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                              </span>
                            </div>
                            
                            {log.log_output && (
                              <div className="mt-2">
                                <pre className="text-xs bg-white/80 p-3 rounded border border-gray-200 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed shadow-sm">
                                  {log.log_output}
                                </pre>
                              </div>
                            )}
                            
                            {log.error_output && (
                              <div className="mt-2">
                                <div className="flex items-center space-x-2 mb-1">
                                  <AlertCircle className="w-4 h-4 text-red-700" />
                                  <span className="text-xs font-semibold text-red-900">Error Details:</span>
                                </div>
                                <pre className="text-xs bg-red-900 text-red-50 p-3 rounded border-2 border-red-700 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                                  {log.error_output}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {machine.status === 'installing' && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-900">
                        <p className="font-semibold mb-1">Installation is still in progress</p>
                        <p>This page will auto-refresh every 3 seconds. Do not close this window.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Audit Logs */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Action History</h3>
                  <button
                    onClick={fetchDebugInfo}
                    className="text-sm text-primary-600 hover:text-primary-700 flex items-center space-x-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Refresh</span>
                  </button>
                </div>
                
                {debugInfo.audit_logs.length === 0 ? (
                  <p className="text-gray-500 text-sm">No action history available</p>
                ) : (
                  <div className="space-y-3">
                    {debugInfo.audit_logs.map((log) => (
                      <div
                        key={log.id}
                        className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <span className="text-2xl">{getActionIcon(log.action)}</span>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className={`font-medium ${getActionColor(log.action)}`}>
                                  {log.action.replace(/_/g, ' ').toUpperCase()}
                                </span>
                                <span className="text-xs text-gray-500">
                                  by {log.username || 'System'}
                                </span>
                              </div>
                              
                              {log.details && (
                                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              )}
                              
                              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                <span className="flex items-center space-x-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{new Date(log.created_at).toLocaleString()}</span>
                                </span>
                                {log.ip_address && (
                                  <span className="font-mono">{log.ip_address}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Metrics */}
              {debugInfo.recent_metrics.length > 0 && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Metrics Activity</h3>
                  <div className="space-y-2">
                    {debugInfo.recent_metrics.map((metric, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-gray-600">{metric.metric_type}</span>
                        <span className="text-gray-500">
                          {new Date(metric.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Debug Commands */}
              <div className="card bg-gray-900 text-white">
                <div className="flex items-center space-x-2 mb-4">
                  <Terminal className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Debug Commands</h3>
                </div>
                <div className="space-y-3 text-sm font-mono">
                  <div>
                    <p className="text-gray-400 mb-1"># Test SSH connection:</p>
                    <code className="text-green-400">
                      ssh {debugInfo.machine.ssh_username}@{debugInfo.machine.ip_address} -p {debugInfo.machine.ssh_port}
                    </code>
                  </div>
                  
                  <div>
                    <p className="text-gray-400 mb-1"># Check if agent is running:</p>
                    <code className="text-green-400">
                      ssh {debugInfo.machine.ssh_username}@{debugInfo.machine.ip_address} "sudo systemctl status atlasnode-agent"
                    </code>
                  </div>
                  
                  <div>
                    <p className="text-gray-400 mb-1"># View agent logs:</p>
                    <code className="text-green-400">
                      ssh {debugInfo.machine.ssh_username}@{debugInfo.machine.ip_address} "sudo journalctl -u atlasnode-agent -n 50"
                    </code>
                  </div>
                  
                  <div>
                    <p className="text-gray-400 mb-1"># Test agent endpoint:</p>
                    <code className="text-green-400">
                      curl http://{debugInfo.machine.ip_address}:{debugInfo.machine.agent_port || 7777}/health
                    </code>
                  </div>
                  
                  <div>
                    <p className="text-gray-400 mb-1"># Restart agent:</p>
                    <code className="text-green-400">
                      ssh {debugInfo.machine.ssh_username}@{debugInfo.machine.ip_address} "sudo systemctl restart atlasnode-agent"
                    </code>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500">
              Failed to load debug information
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="btn-secondary w-full"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

