import { useEffect, useState } from 'react';
import { apiClient } from './api';
import { Search, Filter, Plus, AlertCircle, CheckCircle2, Clock, Trash2 } from 'lucide-react'; // <-- Added Trash2
import TicketFormModal from './TicketFormModal';

export default function TicketMaster() {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);

    const fetchTickets = () => {
        setLoading(true);
        apiClient.get('/tickets')
            .then(response => {
                setTickets(response.data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch tickets:", err);
                setLoading(false);
            });
    };

    useEffect(() => { fetchTickets(); }, []);

    // --- NEW: Delete Ticket Handler ---
    const handleDeleteTicket = async (e, ticketId) => {
        e.stopPropagation(); // Prevents the row click (Edit Modal) from firing
        
        if (!window.confirm(`Are you absolutely sure you want to delete ticket ${ticketId}? This cannot be undone.`)) {
            return;
        }

        try {
            await apiClient.delete(`/tickets/${ticketId}`);
            fetchTickets(); // Refresh the list after successful deletion
        } catch (err) {
            console.error("Failed to delete ticket:", err);
            alert(err.response?.data?.detail || "Failed to delete ticket. Check your permissions.");
        }
    };

    // Status Counters
    const openCounts = tickets.filter(t => t.status === 'Open').length;
    const resolvedCounts = tickets.filter(t => t.status === 'Closed' || t.status === 'Temporary Closed').length;

    // Filter Logic
    const filteredTickets = tickets.filter(ticket => {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
            ticket.ticket_id.toLowerCase().includes(query) || 
            (ticket.project_name || '').toLowerCase().includes(query) ||
            ticket.client_code.toLowerCase().includes(query);
        const matchesStatus = statusFilter === 'All' || ticket.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Ticket Management</h1>
                    <p className="text-slate-500 text-sm">Track, update, and resolve client issues.</p>
                </div>
                
                {/* --- Action Buttons --- */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                        onClick={() => { setSelectedTicket(null); setIsModalOpen(true); }}
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-200"
                    >
                        <Plus size={20} /> Open New Ticket
                    </button>
                </div>
            </div>

            {/* Top Status Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-red-50 rounded-lg text-red-600"><AlertCircle size={24}/></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Open Issues</p>
                        <p className="text-xl font-black text-slate-900">{openCounts}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 opacity-70">
                    <div className="p-3 bg-blue-50 rounded-lg text-blue-600"><Clock size={24}/></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Avg. Response</p>
                        <p className="text-xl font-black text-slate-900">Tracked</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600"><CheckCircle2 size={24}/></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Resolved Total</p>
                        <p className="text-xl font-black text-slate-900">{resolvedCounts}</p>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search by Ticket ID, Client Code, or Project Name..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                </div>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <Filter size={18} className="text-slate-400" />
                    <select 
                        value={statusFilter} 
                        onChange={(e) => setStatusFilter(e.target.value)} 
                        className="bg-transparent text-sm font-semibold text-slate-700 outline-none"
                    >
                        <option value="All">All Statuses</option>
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Temporary Closed">Temporary Closed</option>
                        <option value="Closed">Closed</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket ID</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Client / Project</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Reporter & Issue</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                            {/* NEW: Action Header */}
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="5" className="p-10 text-center text-slate-400">Loading tickets...</td></tr>
                        ) : filteredTickets.length > 0 ? (
                            filteredTickets.map((ticket) => (
                                <tr 
                                    key={ticket.ticket_id} 
                                    onClick={() => { setSelectedTicket(ticket); setIsModalOpen(true); }}
                                    className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                                >
                                    <td className="px-6 py-4 font-mono text-sm font-bold text-blue-600">{ticket.ticket_id}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900">{ticket.client_code}</div>
                                        <div className="text-xs text-slate-500">{ticket.project_name || 'N/A'}</div>
                                    </td>
                                    <td className="px-6 py-4 max-w-xs">
                                        <div className="font-semibold text-slate-700 text-sm mb-1">{ticket.reporter_name}</div>
                                        <p className="text-xs text-slate-500 truncate">{ticket.issue_description}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter flex items-center gap-1 w-fit ${
                                            ticket.status === 'Open' ? 'bg-red-100 text-red-600' : 
                                            ticket.status === 'Closed' ? 'bg-emerald-100 text-emerald-600' : 
                                            ticket.status === 'In Progress' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {ticket.status === 'Closed' ? <CheckCircle2 size={12}/> : ticket.status === 'Open' ? <AlertCircle size={12}/> : null}
                                            {ticket.status}
                                        </span>
                                    </td>
                                    {/* NEW: Action Cell with Delete Button */}
                                    <td className="px-6 py-4 text-right">
                                            {/* RBAC Wrap: Only show if user has permission OR is an Admin */}
                                    {(JSON.parse(localStorage.getItem('permissions') || '{}').can_delete_tickets || localStorage.getItem('role') === 'Admin') && (
                                        <button
                                                onClick={(e) => handleDeleteTicket(e, ticket.ticket_id)}
                                                className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete Ticket"
                                                                >
                                            <Trash2 size={18} />
                                        </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="5" className="p-10 text-center text-slate-400 italic">No tickets found matching your criteria.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <TicketFormModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                ticketToEdit={selectedTicket}
                onSuccess={() => { setIsModalOpen(false); fetchTickets(); }} 
            />

        </div>
    );
}
