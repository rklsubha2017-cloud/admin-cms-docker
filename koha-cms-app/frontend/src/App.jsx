import VpnMaster from './VpnMaster';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import ClientMaster from './ClientMaster';
import TicketMaster from './TicketMaster';
import AccountingMaster from './AccountingMaster';
import ReportMaster from './ReportMaster';
import SettingsMaster from './SettingsMaster';
import Login from './Login';
// Added 'Network' icon for the VPN menu link
import { LayoutDashboard, Users, Ticket, Receipt, FileText, LogOut, Settings, ShieldAlert, ArrowLeft, Network } from 'lucide-react'; 

// --- Professional Security Guard ---
const ProtectedRoute = ({ children, requiredPermission }) => {
    const role = localStorage.getItem('role');
    const permissions = JSON.parse(localStorage.getItem('permissions') || '{}');

    // 1. Admins bypass all frontend checks
    if (role === 'Admin') {
        return children;
    }

    // 2. If a specific permission is required and missing, show the 403 UI
    if (requiredPermission && !permissions[requiredPermission]) {
        return (
            <div className="flex flex-col items-center justify-center h-[70vh] text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-red-100">
                    <ShieldAlert size={48} className="text-red-500" />
                </div>
                <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Access Restricted</h1>
                <p className="text-slate-500 max-w-md mb-8 font-medium">
                    Your current security profile does not have clearance to view this module. Please contact the Superadmin if you need access.
                </p>
                <Link to="/" className="inline-flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition-all shadow-lg">
                    <ArrowLeft size={18} /> Return to Dashboard
                </Link>
            </div>
        );
    }

    // 3. Allowed
    return children;
};

function App() {
  const isAuthenticated = !!localStorage.getItem('token');
  const userRole = localStorage.getItem('role'); 
  
  // Safely parse the permissions object we saved during login
  const perms = JSON.parse(localStorage.getItem('permissions') || '{}');

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  // --- UNAUTHENTICATED ZONE ---
  if (!isAuthenticated) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    );
  }

  // --- AUTHENTICATED ZONE ---
  return (
    <Router>
      <div className="flex h-screen bg-gray-50 font-sans antialiased text-slate-900">
        
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-2xl">
          <div className="p-8 border-b border-slate-800">
            <h2 className="text-2xl font-bold tracking-tight text-blue-400">Koha CMS</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-semibold">Management Suite</p>
          </div>
          
          <nav className="flex-1 px-4 py-6 space-y-1">
            <SidebarLink to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" />
            
            {/* CONDITIONAL RENDERING BASED ON RBAC PERMISSIONS */}
            {perms.can_manage_clients && (
              <SidebarLink to="/clients" icon={<Users size={20} />} label="Clients" />
            )}
            
            {perms.can_manage_tickets && (
              <SidebarLink to="/tickets" icon={<Ticket size={20} />} label="Tickets" />
            )}
            
            {perms.can_manage_accounting && (
              <SidebarLink to="/accounting" icon={<Receipt size={20} />} label="Accounting" />
            )}
            
            {perms.can_view_reports && (
              <SidebarLink to="/reports" icon={<FileText size={20} />} label="Reports" />
            )}
            
            {/* Conditional Settings & VPN Link: Only visible to Admins or Superadmins */}
            {(userRole === 'Admin' || perms.is_superadmin) && (
              <>
                <SidebarLink to="/settings" icon={<Settings size={20} />} label="Settings" />
                {/* --- ADDED VPN SIDEBAR LINK HERE --- */}
                <SidebarLink to="/vpn" icon={<Network size={20} />} label="VPN Network" />
              </>
            )}
          </nav>

          <div className="p-4 bg-slate-950">
            <button 
              onClick={handleLogout} 
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-lg transition-all"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-10">
          <div className="max-w-6xl mx-auto">
            <Routes>
              {/* Dashboard is open to everyone who is logged in */}
              <Route path="/" element={<Dashboard />} />
              
              {/* --- SECURED ROUTES --- */}
              <Route 
                  path="/clients" 
                  element={
                      <ProtectedRoute requiredPermission="can_manage_clients">
                          <ClientMaster />
                      </ProtectedRoute>
                  } 
              />
              <Route 
                  path="/tickets" 
                  element={
                      <ProtectedRoute requiredPermission="can_manage_tickets">
                          <TicketMaster />
                      </ProtectedRoute>
                  } 
              />
              <Route 
                  path="/accounting" 
                  element={
                      <ProtectedRoute requiredPermission="can_manage_accounting">
                          <AccountingMaster />
                      </ProtectedRoute>
                  } 
              />
              <Route 
                  path="/reports" 
                  element={
                      <ProtectedRoute requiredPermission="can_view_reports">
                          <ReportMaster />
                      </ProtectedRoute>
                  } 
              />
              <Route 
                  path="/settings" 
                  element={
                      <ProtectedRoute requiredPermission="is_superadmin">
                          <SettingsMaster />
                      </ProtectedRoute>
                  } 
              />
              
              {/* --- FIXED: MOVED VPN ROUTE HERE AND PROTECTED IT --- */}
              <Route 
                  path="/vpn" 
                  element={
                      <ProtectedRoute requiredPermission="is_superadmin">
                          <VpnMaster />
                      </ProtectedRoute>
                  } 
              />

              {/* Wildcard MUST stay at the very bottom */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </main>

      </div>
    </Router>
  );
}

function SidebarLink({ to, icon, label }) {
  return (
    <Link 
      to={to} 
      className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all group"
    >
      <span className="group-hover:text-blue-400">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}

export default App;
