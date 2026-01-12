import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import api from '../utils/api';

export default function AddMachineModal({ onClose, onSuccess }) {
  // Auto-detect control server URL from browser location
  const detectedControlServer = `${window.location.protocol}//${window.location.hostname}:5000`;
  
  const [formData, setFormData] = useState({
    name: '',
    hostname: '',
    ip_address: '',
    ssh_port: '22',
    ssh_username: '',
    auth_method: 'password',
    password: '',
    private_key: '',
    requires_sudo: true,
    sudo_password: '',
    control_server_url: detectedControlServer // Auto-filled with detected URL
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/machines', formData);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add machine');
      console.error('Add machine error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Add New Machine</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Machine Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="input"
                placeholder="e.g., Main Server"
                required
              />
            </div>

            <div>
              <label className="label">Hostname *</label>
              <input
                type="text"
                name="hostname"
                value={formData.hostname}
                onChange={handleChange}
                className="input"
                placeholder="e.g., server.local"
                required
              />
            </div>

            <div>
              <label className="label">IP Address *</label>
              <input
                type="text"
                name="ip_address"
                value={formData.ip_address}
                onChange={handleChange}
                className="input"
                placeholder="e.g., 192.168.1.100"
                required
              />
            </div>

            <div>
              <label className="label">SSH Port *</label>
              <input
                type="number"
                name="ssh_port"
                value={formData.ssh_port}
                onChange={handleChange}
                className="input"
                placeholder="22"
                required
                min="1"
                max="65535"
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">SSH Username *</label>
              <input
                type="text"
                name="ssh_username"
                value={formData.ssh_username}
                onChange={handleChange}
                className="input"
                placeholder="e.g., root or admin"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Authentication Method *</label>
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="auth_method"
                    value="password"
                    checked={formData.auth_method === 'password'}
                    onChange={handleChange}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <span>Password</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="auth_method"
                    value="key"
                    checked={formData.auth_method === 'key'}
                    onChange={handleChange}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <span>Private Key</span>
                </label>
              </div>
            </div>

            {formData.auth_method === 'password' ? (
              <div className="md:col-span-2">
                <label className="label">SSH Password *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="input"
                  placeholder="Enter SSH password"
                  required
                />
              </div>
            ) : (
              <div className="md:col-span-2">
                <label className="label">SSH Private Key *</label>
                <textarea
                  name="private_key"
                  value={formData.private_key}
                  onChange={handleChange}
                  className="input"
                  rows="6"
                  placeholder="Paste your private key here"
                  required
                />
              </div>
            )}

            <div className="md:col-span-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="requires_sudo"
                  checked={formData.requires_sudo}
                  onChange={(e) => setFormData(prev => ({ ...prev, requires_sudo: e.target.checked }))}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Installation requires sudo privileges
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Most installations need sudo to install packages and create system services
              </p>
            </div>

            {formData.requires_sudo && (
              <div className="md:col-span-2">
                <label className="label">Sudo Password</label>
                <input
                  type="password"
                  name="sudo_password"
                  value={formData.sudo_password}
                  onChange={handleChange}
                  className="input"
                  placeholder="Enter sudo password (leave empty if same as SSH password)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty if sudo password is the same as SSH password or if user has passwordless sudo
                </p>
              </div>
            )}

            {/* Control Server URL - CRITICAL */}
            <div className="md:col-span-2 border-t pt-4 mt-4">
              <label className="label text-base font-semibold">Control Server URL *</label>
              <input
                type="text"
                name="control_server_url"
                value={formData.control_server_url}
                onChange={handleChange}
                className="input"
                placeholder="http://192.168.0.5:5000"
                required
              />
              <div className="mt-2 text-xs text-gray-600 space-y-1">
                <p className="font-medium">
                  ℹ️ This is the URL where agents will connect back to this control server.
                </p>
                <p>
                  <strong>Auto-detected:</strong> {detectedControlServer}
                </p>
                <p className="text-yellow-700">
                  ⚠️ If agents are on a different network, change this to your server's IP address that's accessible from the agent machines.
                </p>
                <p className="mt-2">
                  Examples:
                </p>
                <ul className="list-disc list-inside ml-2">
                  <li><code>http://192.168.0.5:5000</code> - Local network</li>
                  <li><code>http://YOUR_PUBLIC_IP:5000</code> - Internet/VPN</li>
                  <li><code>https://atlas.example.com</code> - Domain name</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> After adding the machine, AtlasNode will automatically
              connect via SSH and install the agent. This may take a few minutes.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Machine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

