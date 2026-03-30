import { useState, useEffect } from 'react';
import { apiClient } from './api';
import { Download, FileSpreadsheet, ShieldAlert, Ticket, Users, Search, Filter } from 'lucide-react';

export default function ReportsMaster() {
    const [activeTab, setActiveTab] = useState('clients');
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);

    // Filter States
    const [filterColumn, setFilterColumn] = useState('All');
    const [filterValue, setFilterValue] = useState('');

    useEffect(() => {
        setLoading(true);
        // Reset filters when tab changes
        setFilterColumn('All');
        setFilterValue('');
        
        apiClient.get(`/reports/${activeTab}`)
            .then(res => setReportData(res.data))
            .catch(err => console.error("Report Fetch Error:", err))
            .finally(() => setLoading(false));
    }, [activeTab]);

    // Dynamic Filter Engine
    const filteredData = reportData.filter(row => {
        if (!filterValue) return true;
        
        const searchTerms = filterValue.toLowerCase();
        if (filterColumn === 'All') {
            return Object.values(row).some(val => 
                String(val || '').toLowerCase().includes(searchTerms)
            );
        } else {
            return String(row[filterColumn] || '').toLowerCase().includes(searchTerms);
        }
    });

    const availableColumns = reportData.length > 0 ? Object.keys(reportData[0]) : [];

    // Professional CSV Exporter
    const handleDownloadCSV = () => {
        if (filteredData.length === 0) return alert("No data matches your filters.");

        const headers = Object.keys(filteredData[0]);
        const csvRows = [];
        
        csvRows.push(headers.map(header => `"${header.replace(/_/g, ' ').toUpperCase()}"`).join(','));
        
        for (const row of filteredData) {
            const values = headers.map(header => {
                const val = row[header];
                const escaped = ('' + (val ?? '')).replace(/"/g, '""').replace(/\n/g, ' '); 
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `Koha_${activeTab.toUpperCase()}_Report_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // Helper to format dates cleanly
    const formatDate = (dateString) => {
        if (!dateString) return null;
        // Check if it looks like a date (contains dashes but no random text)
        if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
            const d = new Date(dateString);
            return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        }
        return dateString;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Intelligence & Reports</h1>
                    <p className="text-slate-500 text-sm">Export production data for financial and operational audits.</p>
                </div>
                <button 
                    onClick={handleDownloadCSV}
                    disabled={filteredData.length === 0 || loading}
                    className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-xl shadow-slate-200"
                >
                    <Download size={18} /> Export Filtered to CSV
                </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-slate-200 overflow-x-auto pb-px scrollbar-hide">
                <TabButton active={activeTab === 'clients'} onClick={() => setActiveTab('clients')} icon={<Users size={16}/>} label="Master Client List" />
                <TabButton active={activeTab === 'financial'} onClick={() => setActiveTab('financial')} icon={<FileSpreadsheet size={16}/>} label="Financial Ledger" />
                <TabButton active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} icon={<Ticket size={16}/>} label="Support & SLAs" />
                <TabButton active={activeTab === 'amc'} onClick={() => setActiveTab('amc')} icon={<ShieldAlert size={16}/>} label="AMC Expiry Radar" />
            </div>

            {/* CUSTOM FILTER BAR */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 w-full md:w-auto">
                    <Filter size={18} className="text-slate-400" />
                    <select 
                        value={filterColumn} 
                        onChange={(e) => setFilterColumn(e.target.value)} 
                        className="bg-transparent text-sm font-semibold text-slate-700 outline-none w-full"
                    >
                        <option value="All">Search All Columns</option>
                        {availableColumns.map(col => (
                            <option key={col} value={col}>{col.replace(/_/g, ' ').toUpperCase()}</option>
                        ))}
                    </select>
                </div>
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder={filterColumn === 'All' ? "Type anything to filter..." : `Filter by ${filterColumn.replace(/_/g, ' ')}...`}
                        value={filterValue} 
                        onChange={(e) => setFilterValue(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-700"
                    />
                </div>
            </div>

            {/* Data Preview Panel */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                        Live Preview <span className="text-blue-600 font-black ml-1">({filteredData.length} records)</span>
                    </h3>
                </div>
                
                <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white sticky top-0 z-10 shadow-sm">
                            <tr>
                                {availableColumns.map(key => (
                                    <th key={key} className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest whitespace-nowrap bg-slate-50 border-b border-slate-200">
                                        {key.replace(/_/g, ' ')}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="20" className="p-10 text-center text-slate-400 font-bold">Extracting Data...</td></tr>
                            ) : filteredData.length > 0 ? (
                                filteredData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                        {Object.values(row).map((val, i) => {
                                            const colName = Object.keys(row)[i];
                                            
                                            // FIX: Determine data types robustly
                                            const isCurrency = colName.includes('amount') || colName.includes('calculated_gst') || colName.includes('total_contract_value');
                                            const isDaysLeft = colName === 'days_until_expiry';

                                            return (
                                                <td key={i} className="px-6 py-3 text-sm font-medium text-slate-700 whitespace-nowrap">
                                                    {isCurrency && val !== null ? (
                                                        <span className="font-bold text-slate-900">₹{parseFloat(val).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                                                    ) : isDaysLeft && val !== null ? (
                                                        val < 0 ? (
                                                            <span className="bg-red-600 text-white px-2 py-1 rounded font-black text-xs uppercase tracking-wider">EXPIRED ({Math.abs(val)} days ago)</span>
                                                        ) : val <= 30 ? (
                                                            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded font-bold">Expiring in {val} Days</span>
                                                        ) : (
                                                            <span className="text-emerald-600 font-bold">{val} Days</span>
                                                        )
                                                    ) : (
                                                        formatDate(val) ?? <span className="text-slate-300 italic">N/A</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="20" className="p-10 text-center text-slate-400 italic">No data matches your current filter.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon, label }) {
    return (
        <button 
            onClick={onClick}
            className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${
                active 
                ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-lg' 
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
        >
            {icon} {label}
        </button>
    );
}
