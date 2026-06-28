import { useState, useEffect } from 'react';
import { 
  Building2, 
  Flame, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Wrench, 
  Trash2, 
  Zap, 
  Shield, 
  Info,
  Clock
} from 'lucide-react';
import { Department, Ticket } from '../types';

interface TrustDashboardProps {
  departments: Department[];
  tickets: Ticket[];
  onRefreshData: () => Promise<void>;
  onBack: () => void;
}

export default function TrustDashboard({
  departments = [],
  tickets = [],
  onRefreshData,
  onBack
}: TrustDashboardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [prevScores, setPrevScores] = useState<{ [name: string]: number }>({});
  const [flash, setFlash] = useState<{ [name: string]: 'up' | 'down' | null }>({});

  // Background polling every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      onRefreshData();
    }, 4000);
    return () => clearInterval(interval);
  }, [onRefreshData]);

  // Track previous scores to trigger green/red visual flashes on changes
  useEffect(() => {
    if (departments.length === 0) return;

    if (Object.keys(prevScores).length === 0) {
      // First load, just initialize the base scores
      const initial: { [name: string]: number } = {};
      departments.forEach(d => {
        initial[d.name] = d.trust_score;
      });
      setPrevScores(initial);
      return;
    }

    const nextFlash: { [name: string]: 'up' | 'down' | null } = {};
    let hasChanges = false;

    departments.forEach(dept => {
      const prev = prevScores[dept.name];
      if (prev !== undefined && prev !== dept.trust_score) {
        if (dept.trust_score > prev) {
          nextFlash[dept.name] = 'up';
          hasChanges = true;
        } else if (dept.trust_score < prev) {
          nextFlash[dept.name] = 'down';
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      setFlash(prev => ({ ...prev, ...nextFlash }));
      
      // Keep flash visible for 2 seconds
      const timer = setTimeout(() => {
        setFlash(prev => {
          const reset = { ...prev };
          Object.keys(nextFlash).forEach(k => {
            reset[k] = null;
          });
          return reset;
        });
      }, 2000);

      // Update stored previous scores
      const updatedScores = { ...prevScores };
      departments.forEach(d => {
        updatedScores[d.name] = d.trust_score;
      });
      setPrevScores(updatedScores);

      return () => clearTimeout(timer);
    } else {
      // Update scores in case verification metrics changed without score change
      const updatedScores = { ...prevScores };
      departments.forEach(d => {
        updatedScores[d.name] = d.trust_score;
      });
      setPrevScores(updatedScores);
    }
  }, [departments]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshData();
    // Brief artificial timeout to make the button state transition satisfying
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  // Helper to get custom icon for each department
  const getDeptIcon = (name: string) => {
    switch (name) {
      case 'Roads Dept':
        return <Wrench size={22} className="text-blue-500" />;
      case 'Sanitation Dept':
        return <Trash2 size={22} className="text-emerald-500" />;
      case 'Electrical Dept':
        return <Zap size={22} className="text-amber-500" />;
      default:
        return <Building2 size={22} className="text-slate-500" />;
    }
  };

  // Helper to get matching colored gradients for the department UI cards
  const getDeptColorTheme = (name: string) => {
    switch (name) {
      case 'Roads Dept':
        return {
          border: 'border-blue-100',
          badge: 'bg-blue-50 text-blue-700 border-blue-100',
          progressFill: 'bg-blue-600',
          glow: 'shadow-blue-500/5'
        };
      case 'Sanitation Dept':
        return {
          border: 'border-emerald-100',
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
          progressFill: 'bg-emerald-600',
          glow: 'shadow-emerald-500/5'
        };
      case 'Electrical Dept':
        return {
          border: 'border-amber-100',
          badge: 'bg-amber-50 text-amber-700 border-amber-100',
          progressFill: 'bg-amber-600',
          glow: 'shadow-amber-500/5'
        };
      default:
        return {
          border: 'border-slate-100',
          badge: 'bg-slate-50 text-slate-700 border-slate-100',
          progressFill: 'bg-slate-600',
          glow: 'shadow-slate-500/5'
        };
    }
  };

  // Dynamic maximum for progress calculation (always scaling up if departments score highly)
  const maxScoreScale = Math.max(150, ...departments.map(d => d.trust_score));

  // Extract trust ledger from tickets (verified resolved or reopened)
  const trustEvents = tickets
    .filter(t => t.status === 'Verified Resolved' || t.status === 'Reopened')
    .slice(0, 8); // Display last 8 audit actions

  return (
    <div className="bg-slate-50 min-h-screen py-10 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left border-b border-slate-200/60 pb-6">
          <div className="space-y-1.5">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer mb-2"
            >
              <ArrowLeft size={13} />
              <span>Back to Portal</span>
            </button>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
              <Shield className="text-blue-600 shrink-0" size={28} />
              <span>Municipal Trust Index</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-2xl">
              Real-time accountability scoreboards for active departments. Every verified resolution by our autonomous Verification Agent adds <strong className="text-emerald-600 font-bold">+2</strong>, while Low-Confidence or failed verifications subtract <strong className="text-rose-600 font-bold">-5</strong>.
            </p>
          </div>

          {/* Action triggers */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 bg-blue-50/50 border border-blue-100/80 px-3 py-1.5 rounded-full text-[11px] text-blue-700 font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <span>Live Updates Enabled</span>
            </div>
            
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all shadow-sm cursor-pointer hover:border-slate-300 active:scale-95 disabled:opacity-55"
              title="Refresh Stats"
            >
              <RefreshCw size={15} className={`transition-transform duration-700 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Dynamic score alert if recently updated */}
        {Object.values(flash).some(v => v !== null && v !== undefined) && (
          <div className="bg-slate-900 text-white rounded-2xl p-3 px-4 flex items-center justify-between text-xs font-bold animate-fade-in shadow-lg">
            <div className="flex items-center gap-2">
              <Flame className="text-amber-400 animate-bounce" size={14} />
              <span>Verification Agent just processed a municipal work order!</span>
            </div>
            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold text-blue-300">
              Live Ledger Update
            </span>
          </div>
        )}

        {/* 3 Department Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {departments.map((dept) => {
            const theme = getDeptColorTheme(dept.name);
            const isFlashedUp = flash[dept.name] === 'up';
            const isFlashedDown = flash[dept.name] === 'down';
            
            // Percentage of progress relative to scale
            const percent = Math.min(100, Math.max(0, (dept.trust_score / maxScoreScale) * 100));

            // Select background wrapper styles based on flash status
            let cardStyle = "bg-white border-slate-100 shadow-sm";
            if (isFlashedUp) {
              cardStyle = "bg-emerald-50/90 border-emerald-400 ring-4 ring-emerald-400/20 shadow-lg shadow-emerald-500/10 scale-[1.01]";
            } else if (isFlashedDown) {
              cardStyle = "bg-rose-50/90 border-rose-400 ring-4 ring-rose-400/20 shadow-lg shadow-rose-500/10 scale-[1.01]";
            }

            return (
              <div
                key={dept.name}
                className={`rounded-3xl border p-6 flex flex-col justify-between space-y-6 transition-all duration-300 ${cardStyle} ${theme.glow}`}
              >
                {/* Card Top: Department Name & Icon */}
                <div className="flex items-center justify-between text-left">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Service Branch</span>
                    <h3 className="font-bold text-base text-slate-800 leading-tight">{dept.name}</h3>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-100/80 flex items-center justify-center shrink-0">
                    {getDeptIcon(dept.name)}
                  </div>
                </div>

                {/* Card Mid: Big Trust Number Display with Flash Trend Indicators */}
                <div className="py-2 text-left relative flex items-baseline gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Trust Score</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-5xl font-black tracking-tight transition-colors duration-300 ${
                        isFlashedUp ? 'text-emerald-700' : isFlashedDown ? 'text-rose-700' : 'text-slate-900'
                      }`}>
                        {dept.trust_score}
                      </span>
                      
                      {/* Trend badging */}
                      <div className="flex flex-col">
                        {isFlashedUp && (
                          <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider animate-bounce">
                            <TrendingUp size={10} />
                            <span>+2 Gain</span>
                          </div>
                        )}
                        {isFlashedDown && (
                          <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider animate-bounce">
                            <TrendingDown size={10} />
                            <span>-5 Loss</span>
                          </div>
                        )}
                        {!isFlashedUp && !isFlashedDown && (
                          <span className="text-[10px] text-slate-400 font-bold block ml-1">
                            {dept.trust_score >= 100 ? 'Excellent' : dept.trust_score >= 70 ? 'Stable' : 'Critical'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Progress Bar */}
                <div className="space-y-1.5 text-left">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span>Performance Rating</span>
                    <span>{dept.trust_score}% of index</span>
                  </div>
                  
                  {/* Outer track */}
                  <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden relative border border-slate-200/20">
                    {/* Progress Fill */}
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${theme.progressFill}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Card Bottom: Audit Metrics */}
                <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-left text-xs">
                  <div className="bg-slate-50/50 rounded-2xl p-2.5 border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Verified</span>
                    <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 size={13} className="text-emerald-500" />
                      {dept.tickets_resolved_verified || 0}
                    </span>
                  </div>
                  <div className="bg-slate-50/50 rounded-2xl p-2.5 border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Rejected</span>
                    <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                      <AlertCircle size={13} className="text-rose-500" />
                      {dept.tickets_resolved_rejected || 0}
                    </span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>

        {/* Lower audit ledger list & explanatory guide */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Trust ledger audit trail */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm space-y-4 text-left">
            <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
              <Clock size={16} className="text-slate-400" />
              Recent AI Verification Logs
            </h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Real-time stream of audit events from field maintenance and autonomous verification decisions:
            </p>

            <div className="space-y-3.5 pt-2">
              {trustEvents.length > 0 ? (
                trustEvents.map((ticket) => {
                  const isVerified = ticket.status === 'Verified Resolved';
                  
                  return (
                    <div 
                      key={ticket.id}
                      className="p-3 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-start gap-3 transition-colors hover:bg-slate-50"
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                        isVerified ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                      }`}>
                        {isVerified ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                      </div>

                      <div className="text-xs space-y-1 flex-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-bold text-slate-800">{ticket.department}</span>
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider border ${
                            isVerified ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                          }`}>
                            {isVerified ? '+2 Trust' : '-5 Trust'}
                          </span>
                        </div>
                        <p className="text-slate-500 font-medium text-[11px] leading-relaxed line-clamp-2">
                          {ticket.description}
                        </p>
                        
                        {/* Latest agent reasoning snippets */}
                        {ticket.reasoning_log && ticket.reasoning_log.length > 0 && (
                          <div className="text-[10px] text-slate-400 font-mono bg-white border border-slate-100 p-2 rounded-xl mt-1.5 leading-relaxed overflow-x-auto">
                            {ticket.reasoning_log[ticket.reasoning_log.length - 1]}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl space-y-1.5">
                  <Info size={28} className="mx-auto text-slate-300" />
                  <p className="text-xs font-semibold">No verification logs recorded yet.</p>
                  <p className="text-[11px] text-slate-400">Complete standard repair workflow loop and trigger automated audits.</p>
                </div>
              )}
            </div>
          </div>

          {/* Guidelines / QA block */}
          <div className="lg:col-span-5 bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-xl space-y-5 text-left">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Shield size={14} className="text-blue-400" />
              Autonomous Auditing Rules
            </h3>

            <div className="space-y-4 text-xs font-medium text-slate-300 leading-relaxed">
              <div className="space-y-1">
                <span className="text-white font-bold block">1. Zero-Trust Verification Policy</span>
                <p>
                  Work claims submitted by field departments remain pending until the Verification Agent analyzes before-and-after imagery. No human signatures, approvals, or overrides can bypass this audit.
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-white font-bold block">2. Rigid Image Matching</span>
                <p>
                  The AI compares details such as background structures, coordinates, lighting conditions, and specific repair signatures. Highly mismatched photos or duplicate uploads are rejected immediately.
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-white font-bold block">3. Heavy Score Penalties</span>
                <p>
                  Successful repairs with &gt;70% AI confidence reward the branch with <strong className="text-emerald-400 font-extrabold">+2</strong>. Low confidence, unidentifiable repair claims, or visual errors trigger an immediate reopening and a major <strong className="text-rose-400 font-extrabold">-5</strong> rating deduction.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                  <Info size={13} />
                </div>
                <span className="text-[10px] text-slate-400 leading-snug">
                  Department standings affect municipal fund allocations and monthly engineering team audits.
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
