import { useState, useEffect } from 'react';
import { apiClient } from './api';
import { Settings, Mail, Map, Users, Save, Plus, Trash2, ShieldCheck, AlertCircle, Database, UploadCloud, Ticket, Receipt, Clock } from 'lucide-react';
import BulkImportModal from './BulkImportModal';

export default function SettingsMaster() {
    const [activeTab, setActiveTab] = useState('smtp');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    // --- State: Bulk Import Modal ---
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importModule, setImportModule] = useState('clients');

    // --- State: SMTP & System Settings ---
    const [smtpData, setSmtpData] = useState({
        smtp_host: '', smtp_port: 587, smtp_user: '', smtp_pass: '', sender_email: '',
        cron_run_time: '08:00', alert_days_before: 30, email_subject: '', email_body: '',
        session_expiry_value: 12, session_expiry_unit: 'Hours'
    });

    // --- State: Region Routing ---
    const [regions, setRegions] = useState([]);
    const [newRegion, setNewRegion] = useState({ region_name: '', manager_email: '' });

    // --- State: Users ---
    const [users, setUsers] = useState([]);
    const [newUser, setNewUser] = useState({
        username: '', password: '', role: 'User', 
        can_manage_clients: true, can_delete_clients: false,
        can_manage_accounting: false, can_delete_accounting: false,
        can_manage_tickets: true, can_delete_tickets: false,
        can_view_reports: false,
        can_view_vault: false // <-- VAULT PERMISSION STATE
    });

    // --- Fetch Data based on active tab ---
    useEffect(() => {
        if (activeTab !== 'data') {
            fetchData();
        }
        setMessage(null);
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'smtp') {
                const res = await apiClient.get('/settings/preferences');
                if (res.data) setSmtpData(res.data);
            } else if (activeTab === 'regions') {
                const res = await apiClient.get('/settings/regions');
                setRegions(res.data);
            } else if (activeTab === 'users') {
                const res = await apiClient.get('/users');
                setUsers(res.data);
            }
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to fetch data. Are you logged in as an Admin?' });
        } finally {
            setLoading(false);
        }
    };

    // --- Handlers ---
    const handleSaveSMTP = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await apiClient.put('/settings/preferences', smtpData);
            setMessage({ type: 'success', text: 'System preferences updated successfully.' });
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to update preferences.' });
        } finally { setLoading(false); }
    };

    const handleAddRegion = async (e) => {
        e.preventDefault();
        try {
            await apiClient.post('/settings/regions', newRegion);
            setNewRegion({ region_name: '', manager_email: '' });
            fetchData();
            setMessage({ type: 'success', text: 'Region routing added.' });
        } catch (err) { setMessage({ type: 'error', text: 'Failed to add region.' }); }
    };

    const handleDeleteRegion = async (id) => {
        if(!window.confirm('Delete this routing rule?')) return;
        try {
            await apiClient.delete(`/settings/regions/${id}`);
            fetchData();
        } catch (err) { setMessage({ type: 'error', text: 'Failed to delete region.' }); }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        try {
            await apiClient.post('/users', newUser);
            setNewUser({ 
                username: '', password: '', role: 'User', 
                can_manage_clients: true, can_delete_clients: false, 
                can_manage_accounting: false, can_delete_accounting: false,
                can_manage_tickets: true, can_delete_tickets: false,
                can_view_reports: false,
                can_view_vault: false // <-- RESET STATE
            });
            fetchData();
            setMessage({ type: 'success', text: 'User account created.' });
        } catch (err) { setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to create user.' }); }
    };

    const handleDeleteUser = async (id, username) => {
        if (username === 'admin') {
            alert("Security Guard: You cannot delete the master admin account.");
            return;
        }
        if(!window.confirm(`Are you absolutely sure you want to delete the user '${username}'? They will lose all access.`)) return;
        
        try {
            await apiClient.delete(`/users/${id}`);
            fetchData();
            setMessage({ type: 'success', text: `User '${username}' has been deleted.` });
        } catch (err) { 
            setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to delete user.' }); 
        }
    };

    const toggleUserPermission = async (userId, field, currentValue) => {
        try {
            const payload = { [field]: !currentValue };
            await apiClient.put(`/users/${userId}`, payload);
            fetchData(); 
        } catch (err) { setMessage({ type: 'error', text: 'Failed to update permissions.' }); }
    };

    const openImportModal = (moduleName) => {
        setImportModule(moduleName);
        setIsImportModalOpen(true);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">System Preferences</h1>
                    <p className="text-slate-500 text-sm">Manage automation, routing, access control, and bulk data.</p>
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                    <AlertCircle size={18} /> {message.text}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200 overflow-x-auto scrollbar-hide">
                <TabButton active={activeTab === 'smtp'} onClick={() => setActiveTab('smtp')} icon={<Settings size={16}/>} label="General Settings" />
                <TabButton active={activeTab === 'regions'} onClick={() => setActiveTab('regions')} icon={<Map size={16}/>} label="Regional Routing" />
                <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users size={16}/>} label="User Access Control" />
                <TabButton active={activeTab === 'data'} onClick={() => setActiveTab('data')} icon={<Database size={16}/>} label="Data Management" />
            </div>

            {/* TAB CONTENT: DATA MANAGEMENT */}
            {activeTab === 'data' && (
                <div className="space-y-6">
                    <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl"></div>
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold mb-2 flex items-center gap-2"><Database className="text-blue-400"/> Bulk Data Imports</h3>
                            <p className="text-slate-400 text-sm max-w-2xl">
                                Download schema-strict templates and upload historical or bulk data directly into the database. 
                                <strong> Note: Existing records with matching IDs/Codes will be overwritten.</strong>
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Clients Import Card */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:border-blue-300 transition-all group">
                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                                <Users size={24} />
                            </div>
                            <h4 className="font-bold text-slate-900 mb-1">Master Clients</h4>
                            <p className="text-xs text-slate-500 mb-6 min-h-[40px]">Import client profiles, contact info, and core AMC lifecycle dates.</p>
                            <button onClick={() => openImportModal('clients')} className="w-full py-2.5 bg-slate-50 hover:bg-blue-600 text-slate-700 hover:text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
                                <UploadCloud size={16}/> Upload CSV
                            </button>
                        </div>

                        {/* Tickets Import Card */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:border-orange-300 transition-all group">
                            <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 mb-4 group-hover:scale-110 transition-transform">
                                <Ticket size={24} />
                            </div>
                            <h4 className="font-bold text-slate-900 mb-1">Support Tickets</h4>
                            <p className="text-xs text-slate-500 mb-6 min-h-[40px]">Import historical helpdesk tickets, resolutions, and closed dates.</p>
                            <button onClick={() => openImportModal('tickets')} className="w-full py-2.5 bg-slate-50 hover:bg-orange-600 text-slate-700 hover:text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
                                <UploadCloud size={16}/> Upload CSV
                            </button>
                        </div>

                        {/* Accounting Import Card */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:border-emerald-300 transition-all group">
                            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-110 transition-transform">
                                <Receipt size={24} />
                            </div>
                            <h4 className="font-bold text-slate-900 mb-1">Financial Ledger</h4>
                            <p className="text-xs text-slate-500 mb-6 min-h-[40px]">Import revenue records, AMC renewals, and financial year data.</p>
                            <button onClick={() => openImportModal('accounting')} className="w-full py-2.5 bg-slate-50 hover:bg-emerald-600 text-slate-700 hover:text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
                                <UploadCloud size={16}/> Upload CSV
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: GENERAL SETTINGS (SMTP & SECURITY) */}
            {activeTab === 'smtp' && (
                <form onSubmit={handleSaveSMTP} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-8">
                    
                    {/* Security & Access Section */}
                    <div className="space-y-4 pb-8 border-b border-slate-100">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4"><Clock size={16} className="text-blue-500"/> Security & Access Policies</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                            <div className="md:col-span-2">
                                <p className="text-xs text-slate-500 mb-2 font-medium">Configure how long a user can remain idle or active before being required to authenticate again. (Note: Changes to this policy will apply to new logins only).</p>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <Field label="Session Timeout Value" type="number" value={smtpData.session_expiry_value || 12} onChange={(e) => setSmtpData({...smtpData, session_expiry_value: parseInt(e.target.value)})} />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Timeout Unit</label>
                                        <select 
                                            value={smtpData.session_expiry_unit || 'Hours'} 
                                            onChange={(e) => setSmtpData({...smtpData, session_expiry_unit: e.target.value})}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20"
                                        >
                                            <option value="Hours">Hours</option>
                                            <option value="Days">Days</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notification Engine Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2"><Mail size={16}/> Mail Server Setup</h3>
                            <Field label="SMTP Host (e.g., smtp.gmail.com)" value={smtpData.smtp_host || ''} onChange={(e) => setSmtpData({...smtpData, smtp_host: e.target.value})} />
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="SMTP Port" type="number" value={smtpData.smtp_port || ''} onChange={(e) => setSmtpData({...smtpData, smtp_port: parseInt(e.target.value)})} />
                                <Field label="Sender Email" type="email" value={smtpData.sender_email || ''} onChange={(e) => setSmtpData({...smtpData, sender_email: e.target.value})} />
                            </div>
                            <Field label="SMTP Username" value={smtpData.smtp_user || ''} onChange={(e) => setSmtpData({...smtpData, smtp_user: e.target.value})} />
                            <Field label="SMTP Password (App Password)" type="password" value={smtpData.smtp_pass || ''} onChange={(e) => setSmtpData({...smtpData, smtp_pass: e.target.value})} />
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2"><ShieldCheck size={16}/> Alert Configuration</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Daily Run Time (HH:MM)" type="time" value={smtpData.cron_run_time || ''} onChange={(e) => setSmtpData({...smtpData, cron_run_time: e.target.value})} />
                                <Field label="Days Before Expiry to Alert" type="number" value={smtpData.alert_days_before || ''} onChange={(e) => setSmtpData({...smtpData, alert_days_before: parseInt(e.target.value)})} />
                            </div>
                            <Field label="Email Subject" value={smtpData.email_subject || ''} onChange={(e) => setSmtpData({...smtpData, email_subject: e.target.value})} />
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Email Body Template</label>
                                <textarea 
                                    value={smtpData.email_body || ''} 
                                    onChange={(e) => setSmtpData({...smtpData, email_body: e.target.value})}
                                    placeholder="Use {site_name}, {client_code}, and {expiry_date} as variables..."
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm h-32 outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end pt-4 border-t">
                        <button type="submit" disabled={loading} className="bg-slate-900 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-black transition flex items-center gap-2 shadow-lg">
                            <Save size={18}/> Save Preferences
                        </button>
                    </div>
                </form>
            )}

            {/* TAB CONTENT: REGIONS */}
            {activeTab === 'regions' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-fit">
                        <h3 className="text-sm font-bold text-slate-900 mb-4">Add Routing Rule</h3>
                        <form onSubmit={handleAddRegion} className="space-y-4">
                            <Field label="Region Name (e.g., North)" value={newRegion.region_name} onChange={(e) => setNewRegion({...newRegion, region_name: e.target.value})} required />
                            <Field label="Manager Email" type="email" value={newRegion.manager_email} onChange={(e) => setNewRegion({...newRegion, manager_email: e.target.value})} required />
                            <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 flex justify-center items-center gap-2"><Plus size={18}/> Add Route</button>
                        </form>
                    </div>
                    <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b text-xs font-bold text-slate-500 uppercase">
                                <tr>
                                    <th className="px-6 py-4">Region</th>
                                    <th className="px-6 py-4">Assigned Email</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {regions.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 font-bold text-slate-900">{r.region_name}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{r.manager_email}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => handleDeleteRegion(r.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={18}/></button>
                                        </td>
                                    </tr>
                                ))}
                                {regions.length === 0 && <tr><td colSpan="3" className="p-8 text-center text-slate-400">No routing rules created yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: USERS (WITH GRANULAR RBAC) */}
            {activeTab === 'users' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h3 className="text-sm font-bold text-slate-900 mb-4">Create New User</h3>
                        <form onSubmit={handleAddUser} className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-1 w-full"><Field label="Username*" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} required /></div>
                            <div className="flex-1 w-full"><Field label="Password*" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required /></div>
                            <div className="flex-1 w-full">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Role</label>
                                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20">
                                    <option value="User">Standard User</option>
                                    <option value="Admin">Administrator</option>
                                </select>
                            </div>
                            <button type="submit" className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 whitespace-nowrap h-[46px] flex items-center gap-2"><Plus size={18}/> Create User</button>
                        </form>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead className="bg-slate-50 border-b text-xs font-black text-slate-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-4 py-4">Clients</th>
                                    <th className="px-4 py-4">Tickets</th>
                                    <th className="px-4 py-4">Accounting</th>
                                    <th className="px-4 py-4">Reports</th>
                                    <th className="px-4 py-4">Vault</th> {/* <-- NEW HEADER */}
                                    <th className="px-4 py-4 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {users.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900">{u.username}</div>
                                            <div className="text-[10px] uppercase font-bold text-blue-500">{u.role} {u.is_superadmin ? '(Super)' : ''}</div>
                                        </td>
                                        
                                        <PermissionGroup user={u} manageField="can_manage_clients" deleteField="can_delete_clients" onToggle={toggleUserPermission} />
                                        <PermissionGroup user={u} manageField="can_manage_tickets" deleteField="can_delete_tickets" onToggle={toggleUserPermission} />
                                        <PermissionGroup user={u} manageField="can_manage_accounting" deleteField="can_delete_accounting" onToggle={toggleUserPermission} />
                                        <PermissionGroup user={u} manageField="can_view_reports" onToggle={toggleUserPermission} />
                                        
                                        {/* NEW VAULT TOGGLE */}
                                        <PermissionGroup user={u} manageField="can_view_vault" onToggle={toggleUserPermission} />
                                        
                                        <td className="px-4 py-4 text-center">
                                            <button 
                                                onClick={() => handleDeleteUser(u.id, u.username)} 
                                                disabled={u.username === 'admin'}
                                                className="text-red-400 hover:text-red-600 p-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                title={u.username === 'admin' ? "Cannot delete master admin" : "Delete User"}
                                            >
                                                <Trash2 size={18}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <BulkImportModal 
                isOpen={isImportModalOpen} 
                onClose={() => setIsImportModalOpen(false)} 
                onSuccess={() => {
                    setIsImportModalOpen(false);
                    setMessage({ type: 'success', text: `${importModule.toUpperCase()} imported successfully!` });
                }} 
                module={importModule} 
            />

        </div>
    );
}

// Helper Components
function TabButton({ active, onClick, icon, label }) {
    return (
        <button 
            onClick={onClick}
            className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${
                active ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
        >
            {icon} {label}
        </button>
    );
}

function Field({ label, value, onChange, type = "text", required = false }) {
    return (
        <div className="w-full">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">{label}</label>
            <input required={required} type={type} value={value} onChange={onChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
        </div>
    );
}

function PermissionGroup({ user, manageField, deleteField, onToggle }) {
    const isManageChecked = user[manageField];
    const isDeleteChecked = user[deleteField];
    const isDisabled = user.is_superadmin; 
    
    return (
        <td className="px-4 py-4 align-top">
            <div className="flex flex-col gap-2.5 mt-1">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer hover:text-blue-600 transition-colors">
                    <input 
                        type="checkbox" 
                        checked={isManageChecked || isDisabled} 
                        disabled={isDisabled}
                        onChange={() => onToggle(user.id, manageField, isManageChecked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                    /> Manage
                </label>
                
                {deleteField && (
                    <label className={`flex items-center gap-2 text-xs font-bold transition-colors cursor-pointer ${isManageChecked ? 'text-red-600 hover:text-red-700' : 'text-slate-300 pointer-events-none'}`}>
                        <input 
                            type="checkbox" 
                            checked={isDeleteChecked || isDisabled} 
                            disabled={isDisabled || !isManageChecked}
                            onChange={() => onToggle(user.id, deleteField, isDeleteChecked)}
                            className="w-4 h-4 text-red-600 rounded focus:ring-red-500 cursor-pointer disabled:opacity-50"
                        /> Delete
                    </label>
                )}
            </div>
        </td>
    );
}
