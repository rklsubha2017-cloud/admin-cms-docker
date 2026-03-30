import { useState, useEffect } from 'react';
import { apiClient } from './api';
import { X, Server, Network, Database, ShieldAlert, KeyRound, Eye, EyeOff, Save, Loader2, Download, FileText } from 'lucide-react';

export default function VaultModal({ isOpen, onClose, clientCode, userRole }) {
    const [activeTab, setActiveTab] = useState('remote');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // --- HANDOVER PDF STATES ---
    const [showHandover, setShowHandover] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedFields, setSelectedFields] = useState([
        'koha_opac_port', 'koha_staff_port', 'koha_admin_user', 'koha_admin_pass',
        'koha_staff_user', 'koha_staff_pass', 'sip2_institution_id', 'sip2_user',
        'sip2_pass', 'sip2_telnet_port', 'anydesk_id', 'teamviewer_id'
    ]);

    const [data, setData] = useState({
        // Remote & OS
        os_details: '', system_ip: '', system_user: '', system_pass: '',
        anydesk_id: '', anydesk_pw: '', teamviewer_id: '', teamviewer_pw: '',
        // Koha Core
        koha_instance: '', koha_staff_port: '', koha_opac_port: '', plack_enabled: false,
        mysql_root_user: '', mysql_root_pass: '', mysql_db_port: '3306', koha_db_name: '', koha_db_user: '', koha_db_pass: '',
        // Security
        export_db_enabled: false, plugin_enabled: false, autobackup_local: false, autobackup_gdrive: false,
        ufw_global_ports: '', ufw_restricted_ports: '', ufw_allowed_ips: '',
        // Integration
        rfid_db_user: '', rfid_db_pass: '', sip2_institution_id: '', sip2_user: '', sip2_pass: '', sip2_telnet_port: '', sip2_raw_port: '',
        // Logins
        koha_admin_user: '', koha_admin_pass: '', koha_staff_user: '', koha_staff_pass: ''
    });

    useEffect(() => {
        if (isOpen && clientCode) {
            fetchVaultData();
        }
        // Reset states when opening/closing
        setActiveTab('remote');
        setError('');
        setSuccessMsg('');
    }, [isOpen, clientCode]);

    const fetchVaultData = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.get(`/vault/${clientCode}`);
            if (Object.keys(res.data).length > 0) {
                setData(prev => ({ ...prev, ...res.data }));
            } else {
                setData({
                    os_details: '', system_ip: '', system_user: '', system_pass: '', anydesk_id: '', anydesk_pw: '', teamviewer_id: '', teamviewer_pw: '',
                    koha_instance: '', koha_staff_port: '', koha_opac_port: '', plack_enabled: false, mysql_root_user: '', mysql_root_pass: '', mysql_db_port: '3306', koha_db_name: '', koha_db_user: '', koha_db_pass: '',
                    export_db_enabled: false, plugin_enabled: false, autobackup_local: false, autobackup_gdrive: false, ufw_global_ports: '', ufw_restricted_ports: '', ufw_allowed_ips: '',
                    rfid_db_user: '', rfid_db_pass: '', sip2_institution_id: '', sip2_user: '', sip2_pass: '', sip2_telnet_port: '', sip2_raw_port: '',
                    koha_admin_user: '', koha_admin_pass: '', koha_staff_user: '', koha_staff_pass: ''
                });
            }
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to retrieve vault data.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccessMsg('');
        try {
            await apiClient.post(`/vault/${clientCode}`, data);
            setSuccessMsg("Vault credentials securely encrypted and saved.");
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to save vault data.");
        } finally {
            setSaving(false);
        }
    };

    // --- HANDOVER PDF GENERATOR LOGIC ---
    const toggleField = (field) => {
        setSelectedFields(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]);
    };

    const generateHandoverPDF = async () => {
        if (selectedFields.length === 0) {
            alert("Please select at least one field.");
            return;
        }
        setIsGenerating(true);
        try {
            // By passing responseType: 'blob', Axios knows not to parse the PDF as JSON
            const response = await apiClient.post('/vault/generate-handover', {
                client_code: clientCode,
                selected_fields: selectedFields
            }, {
                responseType: 'blob' 
            });

            // Create download link for the Blob
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Handover_${clientCode}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            setShowHandover(false);
            setSuccessMsg("Handover document generated successfully.");
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (error) {
            alert("Failed to generate document. Check console or verify Admin permissions.");
        } finally {
            setIsGenerating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 text-slate-300 w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] border border-slate-700 overflow-hidden relative">
                
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-950">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center">
                            <Server size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Technical Vault</h2>
                            <p className="text-xs font-mono text-indigo-400 uppercase tracking-widest">{clientCode}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-64 bg-slate-950/50 border-r border-slate-800 p-4 space-y-2 overflow-y-auto">
                        <TabButton active={activeTab === 'remote'} onClick={() => setActiveTab('remote')} icon={<Network size={16}/>} label="Remote Access & OS" />
                        <TabButton active={activeTab === 'koha'} onClick={() => setActiveTab('koha')} icon={<Database size={16}/>} label="Koha Core & DB" />
                        <TabButton active={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={<ShieldAlert size={16}/>} label="Security & Backup" />
                        <TabButton active={activeTab === 'integration'} onClick={() => setActiveTab('integration')} icon={<Server size={16}/>} label="Integrations (SIP2/RFID)" />
                        <TabButton active={activeTab === 'logins'} onClick={() => setActiveTab('logins')} icon={<KeyRound size={16}/>} label="Application Logins" />
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 p-8 overflow-y-auto bg-slate-900 relative">
                        {loading ? (
                            <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
                        ) : (
                            <form id="vault-form" onSubmit={handleSave} className="space-y-8 max-w-3xl">
                                
                                {error && <div className="p-4 bg-red-500/10 border border-red-500/50 text-red-400 rounded-xl text-sm font-bold">{error}</div>}
                                {successMsg && <div className="p-4 bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 rounded-xl text-sm font-bold">{successMsg}</div>}

                                {/* TAB 1: REMOTE ACCESS & OS */}
                                {activeTab === 'remote' && (
                                    <div className="space-y-6 animate-in fade-in">
                                        <SectionHeader title="Operating System" />
                                        <div className="grid grid-cols-2 gap-4">
                                            <Field label="OS Details (e.g. Ubuntu 24.04 LTS)" val={data.os_details} setVal={v => setData({...data, os_details: v})} />
                                            <Field label="System IP (Static)" val={data.system_ip} setVal={v => setData({...data, system_ip: v})} />
                                            <Field label="System User" val={data.system_user} setVal={v => setData({...data, system_user: v})} />
                                            <PasswordField label="System Password" val={data.system_pass} setVal={v => setData({...data, system_pass: v})} />
                                        </div>

                                        <SectionHeader title="Remote Desktop" />
                                        <div className="grid grid-cols-2 gap-4">
                                            <Field label="Anydesk ID" val={data.anydesk_id} setVal={v => setData({...data, anydesk_id: v})} />
                                            <PasswordField label="Anydesk Password" val={data.anydesk_pw} setVal={v => setData({...data, anydesk_pw: v})} />
                                            <Field label="TeamViewer ID" val={data.teamviewer_id} setVal={v => setData({...data, teamviewer_id: v})} />
                                            <PasswordField label="TeamViewer Password" val={data.teamviewer_pw} setVal={v => setData({...data, teamviewer_pw: v})} />
                                        </div>
                                    </div>
                                )}

                                {/* TAB 2: KOHA CORE */}
                                {activeTab === 'koha' && (
                                    <div className="space-y-6 animate-in fade-in">
                                        <SectionHeader title="Instance Configuration" />
                                        <div className="grid grid-cols-2 gap-4">
                                            <Field label="Instance Name" val={data.koha_instance} setVal={v => setData({...data, koha_instance: v})} />
                                            <div className="flex items-center gap-2 mt-6">
                                                <input type="checkbox" checked={data.plack_enabled} onChange={e => setData({...data, plack_enabled: e.target.checked})} className="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-700 rounded focus:ring-indigo-600 focus:ring-offset-slate-900" />
                                                <span className="text-sm font-bold text-slate-300">Plack Enabled (High Performance)</span>
                                            </div>
                                            <Field label="Staff Port" val={data.koha_staff_port} setVal={v => setData({...data, koha_staff_port: v})} />
                                            <Field label="OPAC Port" val={data.koha_opac_port} setVal={v => setData({...data, koha_opac_port: v})} />
                                        </div>

                                        <SectionHeader title="MySQL / MariaDB Details" />
                                        <div className="grid grid-cols-2 gap-4">
                                            <Field label="MySQL Root User" val={data.mysql_root_user} setVal={v => setData({...data, mysql_root_user: v})} />
                                            <PasswordField label="MySQL Root Password" val={data.mysql_root_pass} setVal={v => setData({...data, mysql_root_pass: v})} />
                                            <Field label="Database Port" val={data.mysql_db_port} setVal={v => setData({...data, mysql_db_port: v})} />
                                            <div className="col-span-2 grid grid-cols-3 gap-4 pt-2">
                                                <Field label="Koha DB Name" val={data.koha_db_name} setVal={v => setData({...data, koha_db_name: v})} />
                                                <Field label="Koha DB User" val={data.koha_db_user} setVal={v => setData({...data, koha_db_user: v})} />
                                                <PasswordField label="Koha DB Password" val={data.koha_db_pass} setVal={v => setData({...data, koha_db_pass: v})} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 3: SECURITY */}
                                {activeTab === 'security' && (
                                    <div className="space-y-6 animate-in fade-in">
                                        <SectionHeader title="System Toggles" />
                                        <div className="grid grid-cols-2 gap-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                                            <Toggle label="Export DB (Staff UI)" checked={data.export_db_enabled} onChange={v => setData({...data, export_db_enabled: v})} />
                                            <Toggle label="Plugins Enabled" checked={data.plugin_enabled} onChange={v => setData({...data, plugin_enabled: v})} />
                                            <Toggle label="Local AutoBackup" checked={data.autobackup_local} onChange={v => setData({...data, autobackup_local: v})} />
                                            <Toggle label="Google Drive Backup" checked={data.autobackup_gdrive} onChange={v => setData({...data, autobackup_gdrive: v})} />
                                        </div>

                                        <SectionHeader title="UFW Firewall Rules" />
                                        <div className="space-y-4">
                                            <Field label="Global Open Ports (e.g. 80, 443, 8080)" val={data.ufw_global_ports} setVal={v => setData({...data, ufw_global_ports: v})} />
                                            <div className="grid grid-cols-2 gap-4">
                                                <Field label="Restricted Ports (e.g. 22, 8051)" val={data.ufw_restricted_ports} setVal={v => setData({...data, ufw_restricted_ports: v})} />
                                                <Field label="Allowed IPs for Restricted Ports" val={data.ufw_allowed_ips} setVal={v => setData({...data, ufw_allowed_ips: v})} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 4: INTEGRATION */}
                                {activeTab === 'integration' && (
                                    <div className="space-y-6 animate-in fade-in">
                                        <SectionHeader title="SIP2 Configuration" />
                                        <div className="grid grid-cols-2 gap-4">
                                            <Field label="Institution ID / Branch Code" val={data.sip2_institution_id} setVal={v => setData({...data, sip2_institution_id: v})} />
                                            <div className="hidden md:block"></div>
                                            <Field label="SIP2 User" val={data.sip2_user} setVal={v => setData({...data, sip2_user: v})} />
                                            <PasswordField label="SIP2 Password" val={data.sip2_pass} setVal={v => setData({...data, sip2_pass: v})} />
                                            <Field label="Raw Port (e.g. 6001)" val={data.sip2_raw_port} setVal={v => setData({...data, sip2_raw_port: v})} />
                                            <Field label="Telnet Port (e.g. 8023)" val={data.sip2_telnet_port} setVal={v => setData({...data, sip2_telnet_port: v})} />
                                        </div>

                                        <SectionHeader title="RFID Database User" />
                                        <div className="grid grid-cols-2 gap-4">
                                            <Field label="RFID DB User" val={data.rfid_db_user} setVal={v => setData({...data, rfid_db_user: v})} />
                                            <PasswordField label="RFID DB Password" val={data.rfid_db_pass} setVal={v => setData({...data, rfid_db_pass: v})} />
                                        </div>
                                        
                                        {/* Placeholder for ZIP file integration later */}
                                        <div className="mt-6 p-4 border border-dashed border-indigo-500/30 bg-indigo-500/5 rounded-2xl flex items-center justify-between">
                                            <div>
                                                <h4 className="text-sm font-bold text-indigo-400">Stunnel Configuration (.zip)</h4>
                                                <p className="text-xs text-slate-500">Secure PSK generation file.</p>
                                            </div>
                                            <button type="button" disabled className="px-4 py-2 bg-slate-800 text-slate-500 rounded-lg text-xs font-bold flex items-center gap-2 cursor-not-allowed">
                                                <Download size={14}/> Coming Soon
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 5: LOGINS */}
                                {activeTab === 'logins' && (
                                    <div className="space-y-6 animate-in fade-in">
                                        <SectionHeader title="Application Access" />
                                        <div className="grid grid-cols-2 gap-4">
                                            <Field label="Master Admin Username" val={data.koha_admin_user} setVal={v => setData({...data, koha_admin_user: v})} />
                                            <PasswordField label="Master Admin Password" val={data.koha_admin_pass} setVal={v => setData({...data, koha_admin_pass: v})} />
                                            <Field label="Library Staff Username" val={data.koha_staff_user} setVal={v => setData({...data, koha_staff_user: v})} />
                                            <PasswordField label="Library Staff Password" val={data.koha_staff_pass} setVal={v => setData({...data, koha_staff_pass: v})} />
                                        </div>
                                    </div>
                                )}
                            </form>
                        )}
                    </div>
                </div>

                {/* Main Modal Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-between items-center">
                    <div>
                        {/* Admin-Only PDF Generator Button */}
                        {userRole === 'Admin' && (
                            <button 
                                type="button" 
                                onClick={() => setShowHandover(true)}
                                className="px-4 py-2.5 rounded-xl font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 flex items-center gap-2 transition-all"
                            >
                                <FileText size={18} /> Generate Handover PDF
                            </button>
                        )}
                    </div>
                    
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-slate-400 hover:text-white transition-colors">Cancel</button>
                        <button 
                            type="submit" form="vault-form" disabled={saving || loading}
                            className="px-8 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all"
                        >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Vault
                        </button>
                    </div>
                </div>
            </div>

            {/* HANDOVER PDF SUB-MODAL */}
            {showHandover && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-emerald-500/30 w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
                        <div className="p-6 border-b border-slate-800 bg-slate-950/50">
                            <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                                <FileText size={20} /> Configure Official Handover Document
                            </h2>
                            <p className="text-sm text-slate-400 mt-1">Select the fields you want to share with the client. Internal server passwords are hidden by default to ensure security.</p>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <div className="grid grid-cols-3 gap-3">
                                {/* Safe / Standard Fields */}
                                <CheckboxField label="OS Details" checked={selectedFields.includes('os_details')} onChange={() => toggleField('os_details')} />
                                <CheckboxField label="Instance Name" checked={selectedFields.includes('koha_instance')} onChange={() => toggleField('koha_instance')} />
                                <CheckboxField label="OPAC Port" checked={selectedFields.includes('koha_opac_port')} onChange={() => toggleField('koha_opac_port')} />
                                <CheckboxField label="Staff Port" checked={selectedFields.includes('koha_staff_port')} onChange={() => toggleField('koha_staff_port')} />
                                <CheckboxField label="Admin Username" checked={selectedFields.includes('koha_admin_user')} onChange={() => toggleField('koha_admin_user')} />
                                <CheckboxField label="Admin Password" checked={selectedFields.includes('koha_admin_pass')} onChange={() => toggleField('koha_admin_pass')} />
                                <CheckboxField label="Staff Username" checked={selectedFields.includes('koha_staff_user')} onChange={() => toggleField('koha_staff_user')} />
                                <CheckboxField label="Staff Password" checked={selectedFields.includes('koha_staff_pass')} onChange={() => toggleField('koha_staff_pass')} />
                                <CheckboxField label="SIP2 Institution ID" checked={selectedFields.includes('sip2_institution_id')} onChange={() => toggleField('sip2_institution_id')} />
                                <CheckboxField label="SIP2 Username" checked={selectedFields.includes('sip2_user')} onChange={() => toggleField('sip2_user')} />
                                <CheckboxField label="SIP2 Password" checked={selectedFields.includes('sip2_pass')} onChange={() => toggleField('sip2_pass')} />
                                <CheckboxField label="SIP2 Telnet Port" checked={selectedFields.includes('sip2_telnet_port')} onChange={() => toggleField('sip2_telnet_port')} />
                                <CheckboxField label="SIP2 Raw Port" checked={selectedFields.includes('sip2_raw_port')} onChange={() => toggleField('sip2_raw_port')} />
                                <CheckboxField label="Anydesk ID" checked={selectedFields.includes('anydesk_id')} onChange={() => toggleField('anydesk_id')} />
                                <CheckboxField label="Teamviewer ID" checked={selectedFields.includes('teamviewer_id')} onChange={() => toggleField('teamviewer_id')} />
                                <CheckboxField label="Export DB (Staff)" checked={selectedFields.includes('export_db_enabled')} onChange={() => toggleField('export_db_enabled')} />
                                <CheckboxField label="Plugins Enabled" checked={selectedFields.includes('plugin_enabled')} onChange={() => toggleField('plugin_enabled')} />
                                <CheckboxField label="Local AutoBackup" checked={selectedFields.includes('autobackup_local')} onChange={() => toggleField('autobackup_local')} />
                                <CheckboxField label="GDrive Backup" checked={selectedFields.includes('autobackup_gdrive')} onChange={() => toggleField('autobackup_gdrive')} />
                                
                                {/* Dangerous / Security Fields (Unchecked by default) */}
                                <CheckboxField label="System IP Address" danger checked={selectedFields.includes('system_ip')} onChange={() => toggleField('system_ip')} />
                                <CheckboxField label="System SSH User" danger checked={selectedFields.includes('system_user')} onChange={() => toggleField('system_user')} />
                                <CheckboxField label="System Password" danger checked={selectedFields.includes('system_pass')} onChange={() => toggleField('system_pass')} />
                                <CheckboxField label="Anydesk Password" danger checked={selectedFields.includes('anydesk_pw')} onChange={() => toggleField('anydesk_pw')} />
                                <CheckboxField label="Teamviewer Password" danger checked={selectedFields.includes('teamviewer_pw')} onChange={() => toggleField('teamviewer_pw')} />
                                <CheckboxField label="MySQL Root User" danger checked={selectedFields.includes('mysql_root_user')} onChange={() => toggleField('mysql_root_user')} />
                                <CheckboxField label="MySQL Root Pass" danger checked={selectedFields.includes('mysql_root_pass')} onChange={() => toggleField('mysql_root_pass')} />
                                <CheckboxField label="MySQL Port" danger checked={selectedFields.includes('mysql_db_port')} onChange={() => toggleField('mysql_db_port')} />
                                <CheckboxField label="Koha DB Name" danger checked={selectedFields.includes('koha_db_name')} onChange={() => toggleField('koha_db_name')} />
                                <CheckboxField label="Koha DB User" danger checked={selectedFields.includes('koha_db_user')} onChange={() => toggleField('koha_db_user')} />
                                <CheckboxField label="Koha DB Password" danger checked={selectedFields.includes('koha_db_pass')} onChange={() => toggleField('koha_db_pass')} />
                                <CheckboxField label="RFID DB User" danger checked={selectedFields.includes('rfid_db_user')} onChange={() => toggleField('rfid_db_user')} />
                                <CheckboxField label="RFID DB Pass" danger checked={selectedFields.includes('rfid_db_pass')} onChange={() => toggleField('rfid_db_pass')} />
                                <CheckboxField label="UFW Global Ports" danger checked={selectedFields.includes('ufw_global_ports')} onChange={() => toggleField('ufw_global_ports')} />
                                <CheckboxField label="UFW Restricted" danger checked={selectedFields.includes('ufw_restricted_ports')} onChange={() => toggleField('ufw_restricted_ports')} />
                                <CheckboxField label="UFW Allowed IPs" danger checked={selectedFields.includes('ufw_allowed_ips')} onChange={() => toggleField('ufw_allowed_ips')} />
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
                            <button type="button" onClick={() => setShowHandover(false)} className="px-6 py-2.5 rounded-xl font-bold text-slate-400 hover:text-white transition-colors">Cancel</button>
                            <button 
                                type="button" onClick={generateHandoverPDF} disabled={isGenerating}
                                className="px-8 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                            >
                                {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} Download Document
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Helper UI Components ---

function CheckboxField({ label, checked, onChange, danger }) {
    return (
        <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${checked ? (danger ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30') : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800'}`}>
            <input 
                type="checkbox" checked={checked} onChange={onChange} 
                className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-emerald-500 focus:ring-emerald-500/50 focus:ring-offset-slate-900" 
            />
            <span className={`text-sm font-bold ${danger ? 'text-red-400' : 'text-slate-300'}`}>{label}</span>
        </label>
    );
}

function TabButton({ active, onClick, icon, label }) {
    return (
        <button 
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                active ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300 border border-transparent'
            }`}
        >
            {icon} {label}
        </button>
    );
}

function SectionHeader({ title }) {
    return <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2 mb-4">{title}</h3>;
}

function Field({ label, val, setVal }) {
    return (
        <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">{label}</label>
            <input 
                type="text" value={val || ''} onChange={e => setVal(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
            />
        </div>
    );
}

function PasswordField({ label, val, setVal }) {
    const [show, setShow] = useState(false);
    return (
        <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">{label}</label>
            <div className="relative">
                <input 
                    type={show ? "text" : "password"} value={val || ''} onChange={e => setVal(e.target.value)}
                    className="w-full pl-4 pr-10 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all font-mono"
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-2.5 text-slate-400 hover:text-white transition-colors">
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
            </div>
        </div>
    );
}

function Toggle({ label, checked, onChange }) {
    return (
        <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
            <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500 relative"></div>
            <span className="text-sm font-bold text-slate-300">{label}</span>
        </label>
    );
}
