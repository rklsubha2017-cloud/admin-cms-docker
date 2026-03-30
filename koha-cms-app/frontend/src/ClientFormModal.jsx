import { useState, useEffect } from 'react';
import { apiClient } from './api';
import { X, Save, Info, Settings, Phone, Wrench, CalendarDays } from 'lucide-react';

export default function ClientFormModal({ isOpen, onClose, onSuccess, clientToEdit }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [formData, setFormData] = useState({
        client_code: '', financial_year: '2025-2026', project_name: '', project_manager: '',
        region: '', city: '', state: '', primary_contact_name: '', primary_contact_number: '', 
        primary_contact_email: '', status: 'Active', managed_by: 'Our Company', 
        vendor_name: '', vendor_status: 'N/A', warranty_amc_period_months: '',
        responsibility_covers: '', koha_installed_on: '', current_koha_version: '', remarks: '',
        // New Lifecycle Dates
        project_start_date: '', project_end_date: '', warranty_start_date: '', warranty_end_date: ''
    });

    useEffect(() => {
        if (isOpen) {
            setError(null);
            if (clientToEdit) {
                const sanitizedData = {};
                Object.keys(formData).forEach(key => {
                    sanitizedData[key] = clientToEdit[key] ?? (key === 'status' ? 'Active' : '');
                });
                setFormData(sanitizedData);
            } else {
                setFormData({
                    client_code: '', financial_year: '2025-2026', project_name: '', project_manager: '',
                    region: '', city: '', state: '', primary_contact_name: '', primary_contact_number: '', 
                    primary_contact_email: '', status: 'Active', managed_by: 'Our Company', 
                    vendor_name: '', vendor_status: 'N/A', warranty_amc_period_months: '',
                    responsibility_covers: '', koha_installed_on: '', current_koha_version: '', remarks: '',
                    project_start_date: '', project_end_date: '', warranty_start_date: '', warranty_end_date: ''
                });
            }
        }
    }, [isOpen, clientToEdit]);

    if (!isOpen) return null;

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (clientToEdit) {
                await apiClient.put(`/clients/${clientToEdit.client_code}`, formData);
            } else {
                const payload = { ...formData, service_details: { ...formData } };
                await apiClient.post('/clients', payload);
            }
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.detail || "Error saving record");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[95vh] overflow-hidden shadow-2xl flex flex-col">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            {clientToEdit ? 'Update Client Record' : 'Register New Client'}
                        </h2>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                            <p>Master code: <span className="font-mono font-bold text-blue-600">{formData.client_code || 'NEW'}</span></p>
                            {clientToEdit?.client_created_at && (
                                <p className="pl-3 border-l border-slate-300">Created: {new Date(clientToEdit.client_created_at).toLocaleDateString()}</p>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 bg-white">
                    {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100">{error}</div>}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        
                        {/* Column 1: Identity & Contact */}
                        <div className="space-y-8">
                            <section>
                                <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest mb-4"><Info size={14}/> Core Identity</div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Client Code*" name="client_code" value={formData.client_code} onChange={handleChange} disabled={!!clientToEdit} />
                                    <Field label="Fin. Year*" name="financial_year" value={formData.financial_year} onChange={handleChange} />
                                </div>
                                <div className="mt-4">
                                    <Field label="Project/Site Name*" name="project_name" value={formData.project_name} onChange={handleChange} />
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <Field label="Project Manager" name="project_manager" value={formData.project_manager} onChange={handleChange} />
                                    <Field label="Site Status" name="status" type="select" value={formData.status} onChange={handleChange} options={['Active', 'Suspended']} />
                                </div>
                            </section>

                            <section>
                                <div className="flex items-center gap-2 text-slate-600 font-bold text-xs uppercase tracking-widest mb-4"><Phone size={14}/> Communication & Location</div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Contact Person" name="primary_contact_name" value={formData.primary_contact_name} onChange={handleChange} />
                                    <Field label="Contact Number" name="primary_contact_number" value={formData.primary_contact_number} onChange={handleChange} />
                                </div>
                                <div className="mt-4">
                                    <Field label="Primary Email" name="primary_contact_email" type="email" value={formData.primary_contact_email} onChange={handleChange} />
                                </div>
                                <div className="grid grid-cols-3 gap-2 mt-4">
                                    <Field label="Region" name="region" value={formData.region} onChange={handleChange} />
                                    <Field label="City" name="city" value={formData.city} onChange={handleChange} />
                                    <Field label="State" name="state" value={formData.state} onChange={handleChange} />
                                </div>
                            </section>

                            {/* NEW: Project & Warranty Timeline */}
                            <section className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100">
                                <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-widest mb-4"><CalendarDays size={14}/> Project & Warranty Timeline</div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Project Start Date" name="project_start_date" type="date" value={formData.project_start_date} onChange={handleChange} />
                                    <Field label="Project End Date" name="project_end_date" type="date" value={formData.project_end_date} onChange={handleChange} />
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <Field label="Warranty Start Date" name="warranty_start_date" type="date" value={formData.warranty_start_date} onChange={handleChange} />
                                    <Field label="Warranty End Date" name="warranty_end_date" type="date" value={formData.warranty_end_date} onChange={handleChange} />
                                </div>
                            </section>
                        </div>

                        {/* Column 2: Technical & AMC */}
                        <div className="space-y-8">
                            <section>
                                <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-widest mb-4"><Wrench size={14}/> Technical Profile</div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Managed By" name="managed_by" type="select" value={formData.managed_by} onChange={handleChange} options={['Our Company', 'Self-Managed', 'Other']} />
                                    <Field label="Koha Version" name="current_koha_version" value={formData.current_koha_version} onChange={handleChange} />
                                </div>
                                <div className="mt-4">
                                    <Field label="Installation Date" name="koha_installed_on" type="date" value={formData.koha_installed_on} onChange={handleChange} />
                                </div>

                                {formData.managed_by === 'Other' && (
                                    <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                        <div className="grid grid-cols-2 gap-4">
                                            <Field label="Vendor Name" name="vendor_name" value={formData.vendor_name} onChange={handleChange} />
                                            <Field label="Vendor Status" name="vendor_status" type="select" value={formData.vendor_status} onChange={handleChange} options={['Active', 'Suspended', 'N/A']} />
                                        </div>
                                    </div>
                                )}
                            </section>

                            <section>
                                <div className="flex items-center gap-2 text-orange-600 font-bold text-xs uppercase tracking-widest mb-4"><Settings size={14}/> AMC & Contract Notes</div>
                                <Field label="AMC Duration (Months) - Legacy" name="warranty_amc_period_months" type="number" value={formData.warranty_amc_period_months} onChange={handleChange} />
                                <div className="mt-4">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">Responsibility Covers</label>
                                    <textarea name="responsibility_covers" value={formData.responsibility_covers} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm h-20 outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Scope of support..." />
                                </div>
                                <div className="mt-4">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">Remarks/Notes</label>
                                    <textarea name="remarks" value={formData.remarks} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm h-20 outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Internal notes..." />
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-12 pt-6 border-t border-slate-100 flex justify-end gap-4">
                        <button type="button" onClick={onClose} className="px-6 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all">Discard</button>
                        <button type="submit" disabled={loading} className="bg-slate-900 text-white px-10 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition-all shadow-xl shadow-slate-200 disabled:opacity-50">
                            {loading ? 'Saving...' : <><Save size={18}/> Commit Changes</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function Field({ label, name, value, onChange, type = "text", disabled = false, options = [] }) {
    const inputClasses = "w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all disabled:opacity-50 disabled:bg-slate-100";
    return (
        <div className="w-full">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1 ml-1">{label}</label>
            {type === "select" ? (
                <select name={name} value={value || ''} onChange={onChange} className={inputClasses}>
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            ) : (
                <input required={label.includes('*')} type={type} name={name} value={value || ''} onChange={onChange} disabled={disabled} className={inputClasses} />
            )}
        </div>
    );
}
