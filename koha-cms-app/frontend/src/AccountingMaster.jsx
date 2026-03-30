import { useEffect, useState } from 'react';
import { apiClient } from './api';
import { Search, Filter, Plus, IndianRupee, FileText, TrendingUp, Trash2 } from 'lucide-react'; // <-- Changed MoreHorizontal to Trash2
import AccountingFormModal from './AccountingFormModal';

export default function AccountingMaster() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [fyFilter, setFyFilter] = useState('All');
    
    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);

    const fetchRecords = () => {
        setLoading(true);
        apiClient.get('/accounting')
            .then(res => { setRecords(res.data); setLoading(false); })
            .catch(err => { console.error(err); setLoading(false); });
    };

    useEffect(() => { fetchRecords(); }, []);

    // --- NEW: Delete Record Handler ---
    const handleDeleteRecord = async (e, recordId) => {
        e.stopPropagation(); // Prevents the row click (Edit Modal) from firing
        
        if (!window.confirm(`Are you absolutely sure you want to delete this revenue record? This will recalculate the client's AMC dates.`)) {
            return;
        }

        try {
            await apiClient.delete(`/accounting/${recordId}`);
            fetchRecords(); // Refresh the list after successful deletion
        } catch (err) {
            console.error("Failed to delete record:", err);
            alert(err.response?.data?.detail || "Failed to delete record. Check your permissions.");
        }
    };

    // Derived Financial Stats
    const totalRevenue = records.reduce((sum, r) => sum + parseFloat(r.amount_without_gst || 0), 0);
    const amcContracts = records.filter(r => r.service_type === 'AMC').length;
    const uniqueFYs = [...new Set(records.map(r => r.financial_year))].sort().reverse();

    const filteredRecords = records.filter(r => {
        const matchesSearch = (r.client_code + r.site_name).toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFY = fyFilter === 'All' || r.financial_year === fyFilter;
        return matchesSearch && matchesFY;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Revenue & Contracts</h1>
                    <p className="text-slate-500 text-sm">Manage financial agreements, AMCs, and site tenders.</p>
                </div>
                
                {/* --- Action Buttons --- */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                        onClick={() => { setSelectedRecord(null); setIsModalOpen(true); }}
                        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200"
                    >
                        <Plus size={20} /> Log Revenue
                    </button>
                </div>
            </div>

            {/* Financial Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600"><IndianRupee size={24}/></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Contract Value</p>
                        <p className="text-2xl font-black text-slate-900">₹{totalRevenue.toLocaleString('en-IN')}</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><FileText size={24}/></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active AMC Contracts</p>
                        <p className="text-2xl font-black text-slate-900">{amcContracts}</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-purple-50 rounded-xl text-purple-600"><TrendingUp size={24}/></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Agreements</p>
                        <p className="text-2xl font-black text-slate-900">{records.length}</p>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search by Client Code or Site Name..." 
                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                </div>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <Filter size={18} className="text-slate-400" />
                    <select value={fyFilter} onChange={(e) => setFyFilter(e.target.value)} className="bg-transparent text-sm font-semibold text-slate-700 outline-none">
                        <option value="All">All Financial Years</option>
                        {uniqueFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                    </select>
                </div>
            </div>

            {/* Ledger Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Client & Site</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Service Details</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Financial Year</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Base Value (₹)</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="5" className="p-10 text-center text-slate-400">Loading ledger...</td></tr>
                        ) : filteredRecords.length > 0 ? (
                            filteredRecords.map((r) => (
                                <tr key={r.id} onClick={() => { setSelectedRecord(r); setIsModalOpen(true); }} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900">{r.site_name}</div>
                                        <div className="text-xs font-mono text-emerald-600 font-semibold">{r.client_code}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                            r.service_type === 'AMC' ? 'bg-blue-100 text-blue-700' : 
                                            r.service_type === 'Fresh Site' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                                        }`}>{r.service_type}</span>
                                        <div className="text-xs text-slate-500 mt-1 font-medium">{r.tendered_for_years} Year(s)</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-semibold text-slate-700">{r.financial_year}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="font-black text-slate-900">₹{parseFloat(r.amount_without_gst).toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase">+18% GST</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {/* NEW: Action Cell with Delete Button */}
                                        {(JSON.parse(localStorage.getItem('permissions') || '{}').can_delete_accounting || localStorage.getItem('role') === 'Admin') && (
                                        <button 
                                            onClick={(e) => handleDeleteRecord(e, r.id)}
                                            className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete Record"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                      )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="5" className="p-10 text-center text-slate-400 italic">No revenue records found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <AccountingFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} recordToEdit={selectedRecord} onSuccess={() => { setIsModalOpen(false); fetchRecords(); }} />
            
        </div>
    );
}
