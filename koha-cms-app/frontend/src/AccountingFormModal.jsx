import { useState, useEffect } from 'react';
import { apiClient } from './api';
import { X, Save, Building2, Receipt, Calculator, IndianRupee, CalendarClock } from 'lucide-react';

export default function AccountingFormModal({ isOpen, onClose, onSuccess, recordToEdit }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [clients, setClients] = useState([]);

    const [formData, setFormData] = useState({
        client_code: '', site_name: '', service_type: 'AMC', 
        amount_without_gst: '', tendered_for_years: 1, financial_year: '2025-2026',
        renewal_date: '', amc_start_date: '', amc_end_date: ''
    });

    useEffect(() => {
        if (isOpen) {
            setError(null);
            apiClient.get('/clients').then(res => setClients(res.data)).catch(console.error);

            if (recordToEdit) {
                setFormData({
                    client_code: String(recordToEdit.client_code || ''),
                    site_name: String(recordToEdit.site_name || ''),
                    service_type: String(recordToEdit.service_type || 'AMC'),
                    amount_without_gst: recordToEdit.amount_without_gst || '',
                    tendered_for_years: recordToEdit.tendered_for_years || 1,
                    financial_year: String(recordToEdit.financial_year || '2025-2026'),
                    renewal_date: recordToEdit.renewal_date || '',
                    amc_start_date: recordToEdit.amc_start_date || '',
                    amc_end_date: recordToEdit.amc_end_date || ''
                });
            } else {
                setFormData({
                    client_code: '', site_name: '', service_type: 'AMC', 
                    amount_without_gst: '', tendered_for_years: 1, financial_year: '2025-2026',
                    renewal_date: '', amc_start_date: '', amc_end_date: ''
                });
            }
        }
    }, [isOpen, recordToEdit]);

    useEffect(() => {
        if (!recordToEdit && formData.client_code) {
            const matchedClient = clients.find(c => c.client_code === formData.client_code);
            if (matchedClient) {
                setFormData(prev => ({
                    ...prev,
                    site_name: matchedClient.project_name || '' 
                }));
            }
        }
    }, [formData.client_code, clients, recordToEdit]);

    if (!isOpen) return null;

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            // If it's a fresh site, clear out AMC dates to keep database clean
            const payload = { ...formData };
            if (payload.service_type === 'Fresh Site') {
                payload.renewal_date = null;
                payload.amc_start_date = null;
                payload.amc_end_date = null;
            }

            if (recordToEdit) {
                await apiClient.put(`/accounting/${recordToEdit.record_id}`, payload);
            } else {
                await apiClient.post('/accounting', payload);
            }
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to save record.");
        } finally {
            setLoading(false);
        }
    };

    const baseAmt = parseFloat(formData.amount_without_gst) || 0;
    const gstAmt = baseAmt * 0.18;
    const totalAmt = baseAmt + gstAmt;

    // Condition to show/hide AMC dates
    const showAMCDates = formData.service_type !== 'Fresh Site';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-600 rounded-lg text-white shadow-lg shadow-emerald-200"><Receipt size={20}/></div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">{recordToEdit ? 'Edit Contract Record' : 'Log New Revenue Contract'}</h2>
                            <p className="text-xs text-slate-500">Master Ledger Entry</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 bg-white">
                    {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100 font-bold">{error}</div>}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        {/* Left Col: Contract Details */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest pb-2 border-b border-slate-100">
                                <Building2 size={14} /> Entity & Contract
                            </div>
                            
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Client Code*</label>
                                <select required name="client_code" value={formData.client_code} onChange={handleChange} disabled={!!recordToEdit} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-100 disabled:text-slate-400">
                                    <option value="">-- Select Client --</option>
                                    {clients.map(c => <option key={c.client_code} value={c.client_code}>{c.client_code} - {c.project_name}</option>)}
                                </select>
                            </div>

                            <Field label="Site Name / Project Name*" name="site_name" value={formData.site_name} onChange={handleChange} />
                            
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Service Type" name="service_type" type="select" value={formData.service_type} onChange={handleChange} options={['Fresh Site', 'AMC', 'Migration', 'Other']} />
                                <Field label="Tendered Years*" name="tendered_for_years" type="number" value={formData.tendered_for_years} onChange={handleChange} />
                            </div>

                            <Field label="Financial Year" name="financial_year" type="select" value={formData.financial_year} onChange={handleChange} options={['2023-2024', '2024-2025', '2025-2026', '2026-2027']} />

                            {/* CONDITIONAL RENDER: Only show AMC dates if it's NOT a Fresh Site */}
                            {showAMCDates && (
                                <div className="mt-6 p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-widest border-b border-emerald-200/50 pb-2">
                                        <CalendarClock size={14} /> AMC / Renewal Timeline
                                    </div>
                                    <Field label="Renewal Action Date" name="renewal_date" type="date" value={formData.renewal_date} onChange={handleChange} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Field label="AMC Start Date" name="amc_start_date" type="date" value={formData.amc_start_date} onChange={handleChange} />
                                        <Field label="AMC End Date" name="amc_end_date" type="date" value={formData.amc_end_date} onChange={handleChange} />
                                    </div>
                                    <p className="text-[10px] text-emerald-600 font-semibold italic mt-1 leading-snug">
                                        Note: Setting the AMC End Date will automatically update this client's Master Expiry Radar without affecting original warranty dates.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Right Col: Financials & Calculator */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-emerald-600 font-bold text-[10px] uppercase tracking-widest pb-2 border-b border-emerald-50">
                                <IndianRupee size={14} /> Financial Valuation
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Base Amount (Without GST)*</label>
                                <div className="relative">
                                    <IndianRupee className="absolute left-3 top-3.5 text-slate-400" size={16} />
                                    <input 
                                        required type="number" step="0.01" name="amount_without_gst" 
                                        value={formData.amount_without_gst} onChange={handleChange} 
                                        className="w-full pl-9 p-3 bg-white border border-slate-300 rounded-xl text-lg font-black text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-inner" 
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mt-4">
                                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase mb-4 tracking-widest">
                                    <Calculator size={14} /> Live Tax Summary
                                </div>
                                <div className="space-y-3 text-sm font-semibold">
                                    <div className="flex justify-between text-slate-500">
                                        <span>Base Value</span>
                                        <span>₹{baseAmt.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-500">
                                        <span>IGST/CGST (18%)</span>
                                        <span>+ ₹{gstAmt.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                                    </div>
                                    <div className="pt-3 border-t border-slate-200 flex justify-between text-lg font-black text-slate-900">
                                        <span>Final Invoice Total</span>
                                        <span className="text-emerald-600">₹{totalAmt.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all">Cancel</button>
                        <button type="submit" disabled={loading} className="bg-emerald-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 disabled:opacity-50">
                            {loading ? 'Processing...' : 'Save Contract Value'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function Field({ label, name, value, onChange, type = "text", disabled = false, options = [], placeholder = "" }) {
    const cls = "w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:bg-slate-100 disabled:text-slate-400";
    return (
        <div className="w-full">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">{label}</label>
            {type === "select" ? (
                <select name={name} value={value} onChange={onChange} className={cls} disabled={disabled}>
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            ) : (
                <input placeholder={placeholder} required={label.includes('*')} type={type} name={name} value={value || ''} onChange={onChange} disabled={disabled} className={cls} />
            )}
        </div>
    );
}
