import { useState, useEffect } from 'react';
import { ShieldAlert, Map, Plus, Home, User, Edit2, Check, Loader2, ShieldCheck } from 'lucide-react';
import { Ticket, Department, NewTicketInput } from './types';
import { generateUserIdentifier, generateUserName } from './utils';
import HomeScreen from './components/HomeScreen';
import ReportForm from './components/ReportForm';
import Dashboard from './components/Dashboard';
import TrustDashboard from './components/TrustDashboard';

export default function App() {
  const [view, setView] = useState<'home' | 'report' | 'dashboard' | 'trust'>('home');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // User identities (saved in localStorage for cross-session continuity)
  const [userId] = useState(() => generateUserIdentifier());
  const [userName, setUserName] = useState(() => generateUserName());
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(userName);

  // Fetch tickets and department data from the backend API
  const fetchData = async () => {
    try {
      const [ticketsRes, deptsRes] = await Promise.all([
        fetch('/api/tickets'),
        fetch('/api/departments')
      ]);

      if (ticketsRes.ok) {
        const ticketsData = await ticketsRes.json();
        setTickets(ticketsData);
      }
      if (deptsRes.ok) {
        const deptsData = await deptsRes.json();
        setDepartments(deptsData);
      }
    } catch (err) {
      console.error('Failed to fetch Civiro portal data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle report submission
  const handleReportSubmit = async (ticketData: NewTicketInput) => {
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketData)
      });

      if (response.ok) {
        const newTicket: Ticket = await response.json();
        // Insert new ticket at the front of local list
        setTickets(prev => [newTicket, ...prev]);
        setSelectedTicketId(newTicket.id);
        // Direct route to dashboard to view reported item on map
        setView('dashboard');
        // Refresh department data in background to show routing updates if any
        fetchData();
      } else {
        throw new Error('Failed to save ticket on server');
      }
    } catch (error) {
      console.error('Error reporting issue:', error);
      throw error;
    }
  };

  // Select a specific ticket and route to dashboard automatically
  const handleSelectTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setView('dashboard');
  };

  // Save custom username
  const handleSaveName = () => {
    if (tempName.trim()) {
      setUserName(tempName.trim());
      localStorage.setItem('civiro_user_name', tempName.trim());
      setIsEditingName(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      
      {/* Top Main Navigation Header */}
      <header className="bg-white border-b border-slate-100 h-16 shrink-0 sticky top-0 z-[1002] shadow-sm">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          
          {/* Logo */}
          <div
            onClick={() => setView('home')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/10 group-hover:scale-105 transition-transform">
              <ShieldAlert size={20} />
            </div>
            <span className="font-black text-xl tracking-tight text-slate-900">
              Civiro
            </span>
          </div>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => setView('home')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                view === 'home' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Home size={14} />
              <span>Home</span>
            </button>
            <button
              id="nav-btn-dashboard"
              onClick={() => {
                setSelectedTicketId(null);
                setView('dashboard');
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                view === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Map size={14} />
              <span>Live Directory</span>
            </button>
            <button
              id="nav-btn-trust"
              onClick={() => setView('trust')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                view === 'trust' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <ShieldCheck size={14} />
              <span>Trust Index</span>
            </button>
            <button
              id="nav-btn-report"
              onClick={() => setView('report')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                view === 'report' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Plus size={14} />
              <span>Report Issue</span>
            </button>
          </nav>

          {/* Citizen Identity Badge / Nickname Editor */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-50 border border-slate-100 rounded-2xl px-3 py-1.5 flex items-center gap-2 text-xs">
              <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 font-bold">
                <User size={12} />
              </div>
              
              {isEditingName ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    maxLength={20}
                    className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px] text-slate-800 font-medium focus:outline-none w-24"
                  />
                  <button
                    onClick={handleSaveName}
                    className="p-0.5 hover:text-emerald-600 transition-colors cursor-pointer"
                  >
                    <Check size={12} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-left">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Your Profile</span>
                    <span className="font-bold text-slate-700">{userName}</span>
                  </div>
                  <button
                    onClick={() => {
                      setTempName(userName);
                      setIsEditingName(true);
                    }}
                    className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  >
                    <Edit2 size={10} />
                  </button>
                </div>
              )}
            </div>
            
            {/* Direct Shortcut to Report Form (Mobile) */}
            <button
              onClick={() => setView('report')}
              className="sm:hidden w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/10 cursor-pointer"
            >
              <Plus size={18} />
            </button>
          </div>

        </div>
      </header>

      {/* Main Responsive Views router */}
      <main className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
            <Loader2 size={36} className="animate-spin text-blue-500" />
            <span className="text-sm font-semibold">Connecting to Civiro network...</span>
          </div>
        ) : view === 'home' ? (
          <HomeScreen
            tickets={tickets}
            departments={departments}
            onReportIssue={() => setView('report')}
            onExploreMap={() => {
              setSelectedTicketId(null);
              setView('dashboard');
            }}
            onSelectTicket={handleSelectTicket}
            onViewTrustDashboard={() => setView('trust')}
          />
        ) : view === 'report' ? (
          <ReportForm
            tickets={tickets}
            onBack={() => setView('home')}
            onSubmit={handleReportSubmit}
          />
        ) : view === 'trust' ? (
          <TrustDashboard
            departments={departments}
            tickets={tickets}
            onRefreshData={fetchData}
            onBack={() => setView('home')}
          />
        ) : (
          <Dashboard
            tickets={tickets}
            departments={departments}
            onRefreshTickets={fetchData}
            onReportIssue={() => setView('report')}
          />
        )}
      </main>

    </div>
  );
}
