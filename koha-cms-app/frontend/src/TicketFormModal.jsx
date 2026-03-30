import { useState, useEffect } from 'react';
import { apiClient } from './api';
import { X, Save, AlertCircle, MessageSquare, ClipboardCheck, CheckCircle2, History } from 'lucide-react';

export default function TicketFormModal({ isOpen, onClose, onSuccess, ticketToEdit }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [clients, setClients] = useState([]);
    const [ticketHistory, setTicketHistory] = useState([]);

    const [formData, setFormData] = useState({
        ticket_id: '', client_code: '', reporter_name: '', reporter_phone: '',
        issue_description: '', current_koha_version: '', status: 'Open',
        remarks: '', upgraded_koha_version: ''
    });

    useEffect(() => {
        if (isOpen) {
            setError(null);
            Promise.all([
                apiClient.get('/clients'),
                apiClient.get('/tickets')
            ]).then(([clientsRes, ticketsRes]) => {
                setClients(clientsRes.data);
                setTicketHistory(ticketsRes.data);
            }).catch(err => console.error(err));

            if (ticketToEdit) {
                setFormData({
                    ticket_id: String(ticketToEdit.ticket_id || ''),
                    client_code: String(ticketToEdit.client_code || ''),
                    reporter_name: String(ticketToEdit.reporter_name || ''),
                    reporter_phone: String(ticketToEdit.reporter_phone || ''),
                    issue_description: String(ticketToEdit.issue_description || ''),
                    current_koha_version: String(ticketToEdit.current_koha_version || ''),
                    status: String(ticketToEdit.status || 'Open'),
                    remarks: String(ticketToEdit.remarks || ''),
                    upgraded_koha_version: String(ticketToEdit.upgraded_koha_version || '')
                });
            } else {
                setFormData({
                    ticket_id: '', client_code: '', reporter_name: '', reporter_phone: '',
                    issue_description: '', current_koha_version: '', status: 'Open',
                    remarks: '', upgraded_koha_version: ''
                });
            }
        }
    }, [isOpen, ticketToEdit]);

    // --- NEW: Advanced Auto-fill Logic ---
    useEffect(() => {
        if (!ticketToEdit && formData.client_code) {
            let updates = {};

            // 1. Always pull the absolute latest Koha Version from the Master Client database
            const selectedClient = clients.find(c => c.client_code === formData.client_code);
            if (selectedClient && selectedClient.current_koha_version) {
                updates.current_koha_version = selectedClient.current_koha_version;
            }

            // 2. Pull the most recent Reporter Name/Phone from ticket history
            if (ticketHistory.length > 0) {
                const lastTicket = ticketHistory
                    .filter(t => t.client_code === formData.client_code)
                    .sort((a, b) => new Date(b.created_on || 0) - new Date(a.created_on || 0))[0];

                if (lastTicket) {
                    updates.reporter_name = lastTicket.reporter_name || '';
                    updates.reporter_phone = lastTicket.reporter_phone || '';
                    
                    // Fallback just in case the Master Client didn't have a version listed
                    if (!updates.current_koha_version && lastTicket.current_koha_version) {
                        updates.current_koha_version = lastTicket.current_koha_version;
                    }
                }
            }

            // Apply updates if we found any
            if (Object.keys(updates).length > 0) {
                setFormData(prev => ({ ...prev, ...updates }));
            }
        }
    }, [formData.client_code, clients, ticketHistory, ticketToEdit]);

    if (!isOpen) return null;

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (ticketToEdit) {
                await apiClient.put(`/tickets/${ticketToEdit.ticket_id}`, formData);
            } else {
                await apiClient.post('/tickets', formData);
            }
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.detail || "Save failed.");
        } finally {
            setLoading(false);
        }
    };

    const showResolutionBox = !!ticketToEdit || formData.status === 'Closed' || formData.status === 'Temporary Closed';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg"><MessageSquare size={20}/></div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">{ticketToEdit ? 'Modify Ticket' : 'Log New Support Request'}</h2>
                            <p className="text-xs text-slate-500 font-mono">Reference: {formData.ticket_id || 'Draft'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 bg-white">
                    {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100 font-bold">{error}</div>}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* Reporter Section */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest pb-2 border-b border-slate-100">
                                <History size={14} /> Reporter Information
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Ticket ID*" name="ticket_id" value={formData.ticket_id} onChange={handleChange} disabled={!!ticketToEdit} placeholder="e.g. TKT-1001" />
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Client Code*</label>
                                    <select required name="client_code" value={formData.client_code} onChange={handleChange} disabled={!!ticketToEdit} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-400">
                                        <option value="">-- Select Client --</option>
                                        {clients.map(c => <option key={c.client_code} value={c.client_code}>{c.client_code} - {c.project_name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Reporter Name*" name="reporter_name" value={formData.reporter_name} onChange={handleChange} />
                                <Field label="Reporter Phone*" name="reporter_phone" value={formData.reporter_phone} onChange={handleChange} />
                            </div>

                            <Field label="Detected Koha Version" name="current_koha_version" value={formData.current_koha_version} onChange={handleChange} />

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Issue Description*</label>
                                <textarea required name="issue_description" value={formData.issue_description} onChange={handleChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm h-32 focus:ring-2 focus:ring-blue-500/20 outline-none" disabled={!!ticketToEdit} />
                            </div>
                        </div>

                        {/* Status/Resolution Section */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-blue-600 font-bold text-[10px] uppercase tracking-widest pb-2 border-b border-blue-50">
                                <ClipboardCheck size={14} /> Service Resolution
                            </div>

                            <Field label="Update Ticket Status" name="status" type="select" value={formData.status} onChange={handleChange} options={['Open', 'In Progress', 'Temporary Closed', 'Closed']} />

                            {showResolutionBox ? (
                                <div className="p-6 bg-blue-50/50 rounded-2xl border-2 border-blue-100 space-y-6">
                                    <Field label="Upgraded Koha Version (Optional)" name="upgraded_koha_version" value={formData.upgraded_koha_version} onChange={handleChange} />
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Resolution Remarks*</label>
                                        <textarea 
                                            name="remarks" 
                                            value={formData.remarks} 
                                            onChange={handleChange} 
                                            className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm h-32 focus:ring-2 focus:ring-blue-500/20 outline-none shadow-inner" 
                                            placeholder="Explain how the issue was resolved..."
                                        />
                                    </div>
                                    {(formData.status === 'Closed' || formData.status === 'Temporary Closed') && (
                                        <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
                                            <CheckCircle2 size={16} /> Ready to finalize and close.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-48 border-2 border-dashed border-slate-100 rounded-2xl flex items-center justify-center p-8 text-center bg-slate-50/20">
                                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                                        Resolution details will be <br/> unlocked upon closing.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all">Cancel</button>
                        <button type="submit" disabled={loading} className="bg-slate-900 text-white px-10 py-3 rounded-xl font-bold hover:bg-black transition-all shadow-xl disabled:opacity-50">
                            {loading ? 'Processing...' : 'Save Ticket Record'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function Field({ label, name, value, onChange, type = "text", disabled = false, options = [], placeholder = "" }) {
    const cls = "w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all disabled:bg-slate-100 disabled:text-slate-400";
    return (
        <div className="w-full">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">{label}</label>
            {type === "select" ? (
                <select name={name} value={value} onChange={onChange} className={cls}>
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            ) : (
                <input placeholder={placeholder} required={label.includes('*')} type={type} name={name} value={value || ''} onChange={onChange} disabled={disabled} className={cls} />
            )}
        </div>
    );
}
