import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from './api';
import { Lock, User, AlertCircle } from 'lucide-react';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await apiClient.post('/login', { username, password });
            
            // Save the token, role, and username to localStorage
            localStorage.setItem('token', response.data.access_token);
            localStorage.setItem('role', response.data.role);
            localStorage.setItem('username', username);
            
            // ---> THE MISSING PIECE: Save the specific RBAC permissions <---
            localStorage.setItem('permissions', JSON.stringify(response.data.permissions || {}));
            
            // Redirect to Dashboard and refresh to mount secure routes
            navigate('/');
            window.location.reload(); 
        } catch (err) {
            setError(err.response?.data?.detail || 'Login failed. Check your connection.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 animate-in zoom-in-95 duration-500">
                <div className="text-center mb-8">
                    <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200">
                        <Lock className="text-white" size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Koha CMS Portal</h2>
                    <p className="text-slate-500 text-sm font-medium mt-2">Authenticate to access enterprise dashboard</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 flex items-center gap-3 text-sm font-bold border border-red-100">
                        <AlertCircle size={18} /> {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Username</label>
                        <div className="relative">
                            <User size={18} className="absolute top-3.5 left-4 text-slate-400" />
                            <input 
                                required type="text" 
                                value={username} onChange={(e) => setUsername(e.target.value)} 
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Password</label>
                        <div className="relative">
                            <Lock size={18} className="absolute top-3.5 left-4 text-slate-400" />
                            <input 
                                required type="password" 
                                value={password} onChange={(e) => setPassword(e.target.value)} 
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" 
                            />
                        </div>
                    </div>

                    <button 
                        disabled={loading} type="submit" 
                        className="w-full py-3.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold transition-all shadow-xl shadow-slate-200 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? 'Authenticating...' : 'Secure Login'}
                    </button>
                </form>
            </div>
        </div>
    );
}
