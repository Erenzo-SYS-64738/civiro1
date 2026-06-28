import { AlertTriangle, MapPin, Shield, Activity, CheckCircle, ArrowRight, HelpCircle, Building2, Flame } from 'lucide-react';
import { Ticket, Department } from '../types';
import { getCategoryMeta } from '../utils';

interface HomeScreenProps {
  tickets: Ticket[];
  departments: Department[];
  onReportIssue: () => void;
  onExploreMap: () => void;
  onSelectTicket: (ticketId: string) => void;
  onViewTrustDashboard?: () => void;
}


export default function HomeScreen({
  tickets,
  departments = [],
  onReportIssue,
  onExploreMap,
  onSelectTicket,
  onViewTrustDashboard
}: HomeScreenProps) {
  // Compute metrics dynamically from the tickets array
  const totalReported = tickets.length;
  const verifiedResolved = tickets.filter((t) => t.status === 'Verified Resolved').length;
  const resolvedClaimed = tickets.filter((t) => t.status === 'Resolved Claimed').length;
  const activeOrReopened = tickets.filter((t) => t.status === 'Open' || t.status === 'Reopened').length;

  // Get 3 most recent tickets
  const recentTickets = tickets.slice(0, 3);

  return (
    <div id="home-screen-container" className="bg-slate-50 min-h-screen">
      
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-slate-900 via-slate-850 to-blue-950 text-white overflow-hidden py-16 px-6 sm:px-12 md:py-20 border-b border-slate-800">
        
        {/* Abstract background graphics */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="max-w-6xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Hero text */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-bold text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
              <span>Civic Action & Trust Network</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.05]">
              Better streets.<br />Safer parks.<br />
              <span className="text-blue-400">Together.</span>
            </h1>
            
            <p className="text-slate-300 text-sm sm:text-base max-w-lg leading-relaxed">
              Civiro is a transparent civic repair network. Report potholes, dark streetlights, water leaks, or litter. Our AI agent automatically categorizes, rates severity, logs reasoning, and routes the work order to the right department.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <button
                id="btn-hero-report"
                onClick={onReportIssue}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 transition-all hover:scale-[1.02] cursor-pointer text-center text-sm"
              >
                Report an Issue
              </button>
              <button
                id="btn-hero-explore"
                onClick={onExploreMap}
                className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl border border-slate-700 transition-all hover:scale-[1.02] cursor-pointer text-center text-sm"
              >
                Explore Live Map
              </button>
            </div>
          </div>

          {/* Stat panel overlay (visual right-hand accent) */}
          <div className="lg:col-span-5 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <h3 className="font-bold text-sm tracking-wider uppercase text-slate-400 flex items-center gap-2">
              <Activity size={14} className="text-blue-400" />
              Live City Stats
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/40">
                <span className="text-2xl font-black text-white block">{totalReported}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Reports</span>
              </div>
              <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/40">
                <span className="text-2xl font-black text-emerald-400 block">{verifiedResolved}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Verified Resolved</span>
              </div>
              <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/40">
                <span className="text-2xl font-black text-amber-400 block">{resolvedClaimed}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Claimed Resolved</span>
              </div>
              <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/40">
                <span className="text-2xl font-black text-rose-400 block">{activeOrReopened}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active & Reopened</span>
              </div>
            </div>

            {/* Department Trust Score Panel */}
            <div 
              onClick={onViewTrustDashboard}
              className="pt-4 border-t border-slate-800 space-y-3 cursor-pointer group/trust"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 group-hover/trust:text-blue-400 transition-colors">
                  <Building2 size={13} className="text-blue-400" />
                  Department Trust Scores
                </h4>
                <span className="text-[10px] font-bold text-blue-400 group-hover/trust:translate-x-0.5 transition-transform flex items-center gap-0.5">
                  View Index &rarr;
                </span>
              </div>
              <div className="space-y-2">
                {departments.map((dept) => (
                  <div key={dept.name} className="flex items-center justify-between bg-slate-950/20 p-2.5 rounded-xl border border-slate-800/30 text-xs hover:bg-slate-950/40 transition-colors">
                    <div className="text-left">
                      <span className="font-semibold block text-slate-200">{dept.name}</span>
                      <span className="text-[10px] text-slate-500">
                        Verified: {dept.tickets_resolved_verified || 0} | Rejected: {dept.tickets_resolved_rejected || 0}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg">
                      <Flame size={12} className="text-amber-500" />
                      <span className="font-bold text-slate-100">{dept.trust_score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Main content sections */}
      <div className="max-w-6xl mx-auto py-16 px-6 space-y-20">
        
        {/* Core Values / Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
              <MapPin size={24} />
            </div>
            <h3 className="font-bold text-lg text-slate-800">Auto-GPS Capture</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Report anywhere with instant accuracy. Our map module utilizes your device's live location services to fix issue coordinates automatically.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle size={24} />
            </div>
            <h3 className="font-bold text-lg text-slate-800">Autonomous Verification</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Real-time accountability. When a department uploads an after photo, our AI-powered Verification Agent compares before & after images to verify the repair.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
              <AlertTriangle size={24} />
            </div>
            <h3 className="font-bold text-lg text-slate-800">Department Trust Index</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Every verified resolution adds +2 to the department's trust rating, while AI-flagged rejections subtract -5. Track municipal performance live.
            </p>
          </div>
        </div>

        {/* Recent Reports Gallery */}
        <div className="space-y-6 text-left">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Recent Citizens Reports</h2>
              <p className="text-sm text-slate-400 mt-1">Check out the latest issues posted by residents in your area.</p>
            </div>
            <button
              onClick={onExploreMap}
              className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              See All on Map <ArrowRight size={14} />
            </button>
          </div>

          {recentTickets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recentTickets.map((ticket) => {
                const catMeta = getCategoryMeta(ticket.category);
                
                let statusBg = 'bg-rose-50 text-rose-700 border-rose-100';
                if (ticket.status === 'Resolved Claimed') {
                  statusBg = 'bg-amber-50 text-amber-700 border-amber-100';
                } else if (ticket.status === 'Verified Resolved') {
                  statusBg = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                } else if (ticket.status === 'Reopened') {
                  statusBg = 'bg-red-50 text-red-700 border-red-100';
                }

                return (
                  <div
                    key={ticket.id}
                    onClick={() => onSelectTicket(ticket.id)}
                    className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden flex flex-col group text-left"
                  >
                    {/* Photo frame */}
                    {ticket.photo_before_url ? (
                      <div className="w-full aspect-video bg-slate-100 relative overflow-hidden">
                        <img
                          src={ticket.photo_before_url}
                          alt={ticket.description}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-video bg-slate-50 border-b border-slate-100 flex items-center justify-center text-slate-300">
                        <HelpCircle size={32} />
                      </div>
                    )}

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${catMeta.bg}`}>
                            {catMeta.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBg}`}>
                            {ticket.status}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 line-clamp-2 leading-relaxed">
                          {ticket.description}
                        </p>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          Routed: {ticket.department} (Severity {ticket.severity}/10)
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-3 border-t border-slate-50 font-medium">
                        <span className="truncate max-w-[150px]">
                          Coordinates: {ticket.lat.toFixed(4)}, {ticket.lng.toFixed(4)}
                        </span>
                        <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-slate-400">
              <HelpCircle size={48} className="mx-auto mb-4 text-slate-300" />
              <p className="text-sm font-semibold">No civic reports found.</p>
              <p className="text-xs mt-1">Be the first to submit an issue using the Report button!</p>
            </div>
          )}
        </div>

        {/* Safety Callout Section */}
        <div className="bg-blue-600 rounded-[32px] p-8 sm:p-12 text-white relative overflow-hidden text-left shadow-xl shadow-blue-600/10">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,_var(--tw-gradient-stops))] from-blue-700 via-blue-600 to-indigo-800 pointer-events-none"></div>
          <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-white/5 rounded-full blur-2xl"></div>
          
          <div className="relative z-10 max-w-3xl space-y-6">
            <Shield size={32} className="text-blue-200" />
            <h2 className="text-3xl font-bold tracking-tight">Need Urgent Public Service?</h2>
            <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
              Civiro is designed for reporting non-emergency public works, local repairs, and neighborhood maintenance issues. If there is an immediate emergency endangering public health or lives (such as a structural fire, gas leak, or crime in progress), please dial <strong>911</strong> or contact emergency dispatch directly.
            </p>
          </div>
        </div>

      </div>

      {/* Simple Footer */}
      <footer className="bg-white border-t border-slate-100 py-8 text-center text-xs text-slate-400">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-medium">
          <span className="font-bold text-slate-800 text-sm tracking-tight">Civiro</span>
          <span>© 2026 Civiro Inc. All analytical routing processed on-chain & powered by Gemini.</span>
        </div>
      </footer>

    </div>
  );
}
