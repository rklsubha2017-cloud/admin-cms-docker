import { useState, useRef } from 'react';
import { apiClient } from './api';
import { X, UploadCloud, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function BulkImportModal({ isOpen, onClose, onSuccess, module }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    // Dynamic text based on the module
    const config = {
        clients: { title: 'Import Clients', path: 'clients', color: 'blue' },
        tickets: { title: 'Import Tickets', path: 'tickets', color: 'orange' },
        accounting: { title: 'Import Ledger', path: 'accounting', color: 'emerald' }
    }[module] || { title: 'Import Data', path: module, color: 'blue' };

    const handleDownloadTemplate = async () => {
        try {
            const response = await apiClient.get(`/${config.path}/template`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${config.path}_template.csv`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (error) {
            alert("Failed to download template.");
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setResult(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        setResult(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await apiClient.post(`/${config.path}/import`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setResult({ type: 'success', data: res.data });
            if (res.data.errors && res.data.errors.length === 0) {
                setTimeout(() => { onSuccess(); }, 2000);
            } else if (res.data.message.includes("0")) {
                setResult({ type: 'error', message: 'Import failed. See errors below.', data: res.data });
            }
        } catch (err) {
            setResult({ type: 'error', message: err.response?.data?.detail || "An unexpected error occurred." });
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setFile(null);
        setResult(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
                
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 bg-${config.color}-600 rounded-lg text-white shadow-lg shadow-${config.color}-200`}><FileSpreadsheet size={20}/></div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">{config.title}</h2>
                            <p className="text-xs text-slate-500">Upload CSV to master database</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
                </div>

                <div className="p-8 space-y-8">
                    <div className={`bg-${config.color}-50/50 border border-${config.color}-100 p-6 rounded-2xl flex items-center justify-between`}>
                        <div>
                            <h3 className={`font-bold text-${config.color}-900 text-sm mb-1`}>Step 1: Get the exact format</h3>
                            <p className={`text-xs text-${config.color}-700/70`}>Download our strictly typed CSV template.</p>
                        </div>
                        <button 
                            onClick={handleDownloadTemplate}
                            className={`bg-white text-${config.color}-600 border border-${config.color}-200 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-${config.color}-50 transition-colors shadow-sm`}
                        >
                            <Download size={16}/> Template
                        </button>
                    </div>

                    <div className="space-y-3">
                        <h3 className="font-bold text-slate-900 text-sm">Step 2: Upload your populated file</h3>
                        <div className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${file ? `border-${config.color}-400 bg-${config.color}-50` : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'}`}>
                            <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                            
                            {!file ? (
                                <div className="flex flex-col items-center justify-center gap-3 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><UploadCloud size={24} /></div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">Click to browse your computer</p>
                                        <p className="text-xs text-slate-400 mt-1">.CSV files only</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center gap-3">
                                    <div className={`w-12 h-12 rounded-full bg-${config.color}-100 flex items-center justify-center text-${config.color}-600`}><FileSpreadsheet size={24} /></div>
                                    <div>
                                        <p className={`text-sm font-bold text-${config.color}-800`}>{file.name}</p>
                                        <p className={`text-xs text-${config.color}-600/70 mt-1`}>Ready for processing</p>
                                    </div>
                                    <button onClick={reset} className="text-xs font-bold text-slate-400 hover:text-red-500 mt-2">Choose different file</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {result && (
                        <div className={`p-5 rounded-2xl border ${result.type === 'error' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-200'}`}>
                            {result.type === 'error' && !result.data ? (
                                <div className="flex items-start gap-3 text-red-700">
                                    <AlertCircle size={20} className="mt-0.5" />
                                    <p className="text-sm font-bold">{result.message}</p>
                                </div>
                            ) : (
                                <div>
                                    <div className={`flex items-center gap-2 font-bold mb-3 ${result.type === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>
                                        {result.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                                        {result.data?.message}
                                    </div>
                                    {result.data?.errors && result.data.errors.length > 0 && (
                                        <div className="mt-4">
                                            <p className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-widest">Partial Errors Log ({result.data.errors.length}):</p>
                                            <div className="bg-white border border-slate-200 rounded-xl p-3 max-h-32 overflow-y-auto text-xs text-red-600 space-y-1 font-mono">
                                                {result.data.errors.map((e, i) => <div key={i}>• {e}</div>)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-200 rounded-xl transition-all">Cancel</button>
                    <button 
                        onClick={handleUpload} disabled={!file || loading} 
                        className={`bg-${config.color}-600 text-white px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-${config.color}-700 transition-all shadow-xl shadow-${config.color}-200 disabled:opacity-50 disabled:shadow-none`}
                    >
                        {loading ? 'Processing...' : <><UploadCloud size={18}/> Import Data</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
