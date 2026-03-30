import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from './api';
import { Users, Ticket, Receipt, ArrowUpRight, Clock, AlertCircle, ShieldAlert, CheckCircle2, TrendingUp, Plus, Activity } from 'lucide-react';

export default function Dashboard() {
    const [stats, setStats] = useState({ 
        clients: 0, 
        suspended: 0,
        expiringAmcs: 0,
        totalTickets: 0,
        openTickets: 0, 
        resolvedTickets: 0,
        revenue: 0 
    });
    const [recentTickets, setRecentTickets] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- RBAC PERMISSIONS ---
    const role = localStorage.getItem('role');
    let permissions = {};
    try {
        permissions = JSON.parse(localStorage.getItem('permissions') || '{}');
    } catch (e) {
        console.error("Could not parse permissions", e);
    }

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [cRes, tRes, aRes] = await Promise.all([
                    apiClient.get('/clients'),
                    apiClient.get('/tickets'),
                    apiClient.get('/accounting')
                ]);

                const clients = cRes.data;
                const tickets = tRes.data;
                const accounting = aRes.data;

                // --- Calculate Advanced Business Logic ---
                const today = new Date();
                const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
                
                let expiringCount = 0;
                let suspendedCount = 0;

                clients.forEach(c => {
                    if (c.status === 'Suspended') suspendedCount++;
                    
                    // --- SMART LOGIC: Check AMC Expiry first, fallback to Warranty End ---
                    const activeDateString = c.current_amc_expiry || c.warranty_end_date;
                    
                    if (activeDateString) {
                        const expiryDate = new Date(activeDateString);
                        // If it's expiring within 30 days OR it is already past due (expired)
                        if (expiryDate <= thirtyDaysFromNow) {
                            expiringCount++;
                        }
                    }
                });

                setStats({
                    clients: clients.length,
                    suspended: suspendedCount,
                    expiringAmcs: expiringCount,
                    totalTickets: tickets.length,
                    openTickets: tickets.filter(t => t.status === 'Open').length,
                    resolvedTickets: tickets.filter(t => t.status === 'Closed').length,
                    revenue: accounting.reduce((acc, curr) => acc + (parseFloat(curr.amount_without_gst) || 0), 0)
                });

                // Sort tickets by date (newest first) and take top 5
                const sortedTickets = tickets.sort((a, b) => new Date(b.created_on) - new Date(a.created_on));
                setRecentTickets(sortedTickets.slice(0, 5));
                
            } catch (err) {
                console.error("Dashboard fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (loading) return (
        <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
                <p className="text-slate-400 font-bold tracking-widest text-sm uppercase">Loading Command Center...</p>
            </div>
        </div>
    );

    // Calculate Ticket Health percentages
    const openPct = stats.totalTickets ? (stats.openTickets / stats.totalTickets) * 100 : 0;
    const closedPct = stats.totalTickets ? (stats.resolvedTickets / stats.totalTickets) * 100 : 0;
    const progressPct = stats.totalTickets ? 100 - openPct - closedPct : 0;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-8 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-60"></div>
                <div className="relative z-10">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Overview</h1>
                    <p className="text-slate-500 mt-1 font-medium text-sm flex items-center gap-2">
                        Welcome back, <span className="text-blue-600 font-bold">{localStorage.getItem('username') || 'Admin'}</span>
                    </p>
                </div>
                <div className="relative z-10 flex gap-3">
                    {/* RBAC CHECK: Ticket Button */}
                    {(role === 'Admin' || permissions.can_manage_tickets) && (
                        <Link to="/tickets" className="bg-slate-900 hover:bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg flex items-center gap-2">
                            <Plus size={16} /> New Ticket
                        </Link>
                    )}
                    
                    {/* RBAC CHECK: Accounting Button */}
                    {(role === 'Admin' || permissions.can_manage_accounting) && (
                        <Link to="/accounting" className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2">
                            Log Revenue
                        </Link>
                    )}
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <StatCard 
                    title="Active Clients" 
                    value={stats.clients - stats.suspended} 
                    subtitle={`${stats.suspended} Suspended`}
                    icon={<Users size={24} className="text-blue-600" />} 
                    color="bg-blue-50" border="hover:border-blue-300"
                />
                <StatCard 
                    title="Expiring/Expired AMCs" 
                    value={stats.expiringAmcs} 
                    subtitle="Past Due or within 30 Days"
                    icon={<ShieldAlert size={24} className={stats.expiringAmcs > 0 ? "text-red-600" : "text-emerald-600"} />} 
                    color={stats.expiringAmcs > 0 ? "bg-red-50" : "bg-emerald-50"} 
                    border={stats.expiringAmcs > 0 ? "border-red-200 hover:border-red-400" : "hover:border-emerald-300"}
                    alert={stats.expiringAmcs > 0}
                />
                <StatCard 
                    title="Open Tickets" 
                    value={stats.openTickets} 
                    subtitle={`${stats.totalTickets} Lifetime Total`}
                    icon={<Ticket size={24} className="text-orange-600" />} 
                    color="bg-orange-50" border="hover:border-orange-300"
                />
                <StatCard 
                    title="Gross Revenue" 
                    value={`₹${(stats.revenue / 100000).toFixed(1)}L`} 
                    subtitle="Excluding GST"
                    icon={<Receipt size={24} className="text-emerald-600" />} 
                    color="bg-emerald-50" border="hover:border-emerald-300"
                />
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Column: Recent Tickets (Takes 2/3 space) */}
                <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Activity size={18} className="text-blue-500" /> Live Ticket Activity
                        </h3>
                        {/* RBAC CHECK: View All Tickets Link */}
                        {(role === 'Admin' || permissions.can_manage_tickets) && (
                            <Link to="/tickets" className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                View All <ArrowUpRight size={14} />
                            </Link>
                        )}
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left">
                            <thead className="bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4">Ticket ID</th>
                                    <th className="px-6 py-4">Client</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Logged</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {recentTickets.length > 0 ? recentTickets.map(ticket => (
                                    <tr key={ticket.ticket_id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4 font-mono text-xs font-bold text-slate-900 group-hover:text-blue-600">{ticket.ticket_id}</td>
                                        <td className="px-6 py-4 text-sm font-semibold text-slate-700">{ticket.client_code}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                                ticket.status === 'Open' ? 'bg-red-100 text-red-700' : 
                                                ticket.status === 'Closed' ? 'bg-emerald-100 text-emerald-700' : 
                                                ticket.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                                            }`}>
                                                {ticket.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-xs text-slate-400 font-medium">
                                            {new Date(ticket.created_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="4" className="p-10 text-center text-slate-400 italic">No recent tickets found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right Column: Insights */}
                <div className="space-y-6">
                    
                    {/* Ticket Health Visualizer */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <h3 className="font-bold text-slate-800 mb-6 text-sm flex items-center gap-2">
                            <TrendingUp size={16} className="text-emerald-500" /> Resolution Health
                        </h3>
                        
                        {/* CSS Progress Bar */}
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex mb-4">
                            <div style={{ width: `${closedPct}%` }} className="h-full bg-emerald-500 transition-all duration-1000"></div>
                            <div style={{ width: `${progressPct}%` }} className="h-full bg-blue-400 transition-all duration-1000"></div>
                            <div style={{ width: `${openPct}%` }} className="h-full bg-red-400 transition-all duration-1000"></div>
                        </div>
                        
                        {/* Legend */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                                <div className="text-xl font-black text-slate-900">{stats.resolvedTickets}</div>
                                <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center justify-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Closed</div>
                            </div>
                            <div>
                                <div className="text-xl font-black text-slate-900">{stats.totalTickets - stats.resolvedTickets - stats.openTickets}</div>
                                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center justify-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-400"></div> Active</div>
                            </div>
                            <div>
                                <div className="text-xl font-black text-slate-900">{stats.openTickets}</div>
                                <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider flex items-center justify-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400"></div> Open</div>
                            </div>
                        </div>
                    </div>

                    {/* System Guard Status */}
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl group-hover:bg-blue-400/30 transition-colors"></div>
                        
                        <div className="flex items-center gap-2 text-emerald-400 mb-4">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></div>
                            <span className="text-[10px] font-black tracking-widest uppercase">System Guard</span>
                        </div>
                        
                        <h4 className="text-lg font-bold mb-2 text-white">Automation Engine Active</h4>
                        <p className="text-slate-400 text-xs leading-relaxed mb-6">
                            Background radar is monitoring <strong className="text-slate-200">{stats.clients}</strong> site contracts. Expiring systems will trigger email alerts tonight at standard run-time.
                        </p>
                        
                        <div className="pt-4 border-t border-slate-700/50 flex items-center justify-between text-xs font-semibold text-slate-300">
                            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-400"/> All systems nominal</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, subtitle, icon, color, border, alert }) {
    return (
        <div className={`bg-white p-6 rounded-3xl shadow-sm border ${border || 'border-slate-200'} transition-all duration-300 hover:-translate-y-1 relative overflow-hidden`}>
            {alert && <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse"></div>}
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl ${color}`}>
                    {icon}
                </div>
            </div>
            <div>
                <p className="text-3xl font-black text-slate-900 tracking-tight">{value}</p>
                <h3 className="text-slate-700 text-sm font-bold mt-1">{title}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-400">{subtitle}</p>
            </div>
        </div>
    );
}
