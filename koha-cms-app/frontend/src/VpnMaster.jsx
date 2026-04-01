import React, { useState, useEffect } from 'react';
import { getVpnNodes, generateVpnKey } from './api'; // adjust import based on your setup

const VpnMaster = () => {
  const [nodes, setNodes] = useState([]);
  const [authKey, setAuthKey] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNodes();
  }, []);

  const fetchNodes = async () => {
    try {
      const data = await getVpnNodes();
      if (data && data.nodes) setNodes(data.nodes);
    } catch (error) {
      console.error("Failed to fetch nodes", error);
    }
  };

  const handleGenerateKey = async () => {
    setLoading(true);
    try {
      // Hardcoded user 'myvpn' and 24 hours expiry for simplicity
      // You can make these dynamic inputs later
      const response = await generateVpnKey({ user: 'myvpn', expiration_hours: 24 });
      if (response.status === 'success') {
        setAuthKey(response.data.preAuthKey.key);
      }
    } catch (error) {
      console.error("Failed to generate key", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">VPN Management (Headscale)</h1>
      
      <div className="bg-white p-4 shadow rounded mb-6">
        <h2 className="text-xl mb-2">Generate Client Script</h2>
        <button 
          onClick={handleGenerateKey} 
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate 24h Registration Key'}
        </button>

        {authKey && (
          <div className="mt-4 p-4 bg-gray-900 text-green-400 rounded overflow-x-auto">
            <p className="mb-2 text-gray-300 text-sm">Run this script on the target Ubuntu client to auto-register:</p>
            <code>
              curl -fsSL https://tailscale.com/install.sh | sh<br/>
              sudo tailscale up --login-server=https://vpn.rrkohademo.in --authkey={authKey}
            </code>
          </div>
        )}
      </div>

      <div className="bg-white p-4 shadow rounded">
        <h2 className="text-xl mb-2">Connected Devices</h2>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b">
              <th className="p-2">Hostname</th>
              <th className="p-2">IP Address</th>
              <th className="p-2">OS</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map(node => (
              <tr key={node.id} className="border-b">
                <td className="p-2">{node.name}</td>
                <td className="p-2">{node.ipAddresses[0]}</td>
                <td className="p-2">{node.os}</td>
                <td className="p-2">
                  <span className={`px-2 py-1 rounded text-xs text-white ${node.online ? 'bg-green-500' : 'bg-red-500'}`}>
                    {node.online ? 'Online' : 'Offline'}
                  </span>
                </td>
              </tr>
            ))}
            {nodes.length === 0 && (
              <tr><td colSpan="4" className="p-4 text-center text-gray-500">No devices connected.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VpnMaster;