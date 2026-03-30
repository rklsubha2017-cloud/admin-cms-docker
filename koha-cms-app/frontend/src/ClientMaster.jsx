import { useState, useEffect } from 'react';
import { apiClient } from './api';
import { Plus, Search, Filter, ShieldCheck, ShieldAlert, Trash2, Server } from 'lucide-react'; // <-- NEW: Server icon imported
import ClientFormModal from './ClientFormModal';
import VaultModal from './VaultModal'; // <-- NEW: Import the Vault component

export default function ClientMaster() {
    const [clients, setClients] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState(null);
    const [loading, setLoading] = useState(true);

    // --- NEW: Vault Modal State ---
    const [isVaultOpen, setIsVaultOpen] = useState(false);
    const [vaultClientCode, setVaultClientCode] = useState(null);

    const fetchClients = async () => {
        try {
            const res = await apiClient.get('/clients');
            setClients(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchClients(); }, []);

    const handleDeleteClient = async (e, clientCode) => {
        e.stopPropagation(); 

        if (!window.confirm(`Are you sure you want to delete client '${clientCode}'? This action cannot be undone.`)) {
            return;
        }

        try {
            await apiClient.delete(`/clients/${clientCode}`);
            fetchClients(); 
        } catch (err) {
            console.error("Failed to delete client:", err);
            alert(err.response?.data?.detail || "Failed to delete client. Check your permissions.");
        }
    };

    // Helper to check vault permissions
    const canViewVault = JSON.parse(localStorage.getItem('permissions') || '{}').can_view_vault || localStorage.getItem('role') === 'Admin';
    const currentUserRole = localStorage.getItem('role');

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Client Master</h1>
                    <p className="text-slate-500 text-sm">Manage site contracts, Koha versions, and contact details.</p>
                </div>
                
                {/* --- Action Buttons --- */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                        onClick={() => { setSelectedClient(null); setIsModalOpen(true); }}
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-200"
                    >
                        <Plus size={20} /> Add New Client
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search by client name or code..." 
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                </div>
                <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-semibold hover:bg-slate-50">
                    <Filter size={18} /> Filters
                </button>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Client Details</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Region</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Koha Version</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="5" className="p-10 text-center text-slate-400">Loading client database...</td></tr>
                            ) : clients.map((client) => (
                                <tr 
                                    key={client.client_code} 
                                    className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                                    onClick={() => { setSelectedClient(client); setIsModalOpen(true); }}
                                >
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{client.project_name}</div>
                                        <div className="text-xs font-mono text-slate-400">{client.client_code}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                                        {client.city}, {client.state}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">
                                            v{client.current_koha_version || '?.?'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {client.status === 'Active' ? (
                                            <span className="flex items-center gap-1.5 w-fit bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                                                <ShieldCheck size={14} /> Active
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 w-fit bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">
                                                <ShieldAlert size={14} /> Suspended
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {/* NEW: Secure Technical Vault Button */}
                                            {canViewVault && (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Stop row click
                                                        setVaultClientCode(client.client_code);
                                                        setIsVaultOpen(true);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                    title="Technical Vault"
                                                >
                                                    <Server size={18} />
                                                </button>
                                            )}

                                            {/* Delete Button */}
                                            {(JSON.parse(localStorage.getItem('permissions') || '{}').can_delete_clients || localStorage.getItem('role') === 'Admin') && (
                                                <button 
                                                    onClick={(e) => handleDeleteClient(e, client.client_code)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Delete Client"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Existing Modal */}
            <ClientFormModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                clientToEdit={selectedClient} 
                onSuccess={() => { setIsModalOpen(false); fetchClients(); }} 
            />

            {/* NEW: Technical Vault Modal */}
            <VaultModal 
                isOpen={isVaultOpen} 
                onClose={() => setIsVaultOpen(false)} 
                clientCode={vaultClientCode} 
                userRole={currentUserRole}
            />

        </div>
    );
}
