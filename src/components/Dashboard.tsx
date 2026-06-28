import React, { useState, useMemo } from 'react';
import {
  Search, Filter, MapPin, Calendar, Check, X, Plus, Clock, CheckCircle2, AlertCircle, Sparkles, Building2, Eye, ShieldCheck, Flame,
  Cpu, Tag, ShieldAlert, FileText, Compass, AlertTriangle, Shield
} from 'lucide-react';
import { Ticket, Department } from '../types';
import { getCategoryMeta, compressImage } from '../utils';
import TicketMap from './TicketMap';

interface ParsedStep {
  timestamp: string;
  originalText: string;
  type: 'report' | 'ai_init' | 'ai_decision' | 'field_work' | 'verify_init' | 'verify_decision' | 'fallback_error';
  title: string;
  description: string;
  details?: {
    category?: string;
    severity?: string;
    department?: string;
    verdict?: string;
    confidence?: number;
    reasoning?: string;
  };
}

function parseLogStep(step: string): ParsedStep {
  const match = step.match(/^\[(.*?)\]\s*(.*)$/);
  const timestamp = match ? match[1] : '';
  const body = match ? match[2] : step;

  let type: ParsedStep['type'] = 'report';
  let title = 'System Log';
  let description = body;
  let details: ParsedStep['details'] = {};

  if (body.includes('Ticket report received') || body.includes('citizen GPS coordinates')) {
    type = 'report';
    title = 'Citizen Issue Reported';
    description = body;
  } else if (body.includes('Submitting image and description to Gemini')) {
    type = 'ai_init';
    title = 'AI Classification Initiated';
    description = 'The submission was sent to the Gemini Vision model for autonomous category classification, routing assignment, and severity calibration.';
  } else if (body.includes('AI Agent classified') || body.includes('AI Agent routed') || body.includes('AI Summary') || body.includes('Rule engine matched')) {
    type = 'ai_decision';
    title = 'AI Triage & Classification';
    description = body;
    
    const catMatch = body.match(/category '(.*?)'/);
    const sevMatch = body.match(/severity (\d+)/);
    const deptMatch = body.match(/routed to department '(.*?)'/);
    const ruleDeptMatch = body.match(/routed to (Roads Dept|Sanitation Dept|Electrical Dept)/);
    const reasonMatch = body.match(/Reason: (.*)$/);

    if (catMatch) details.category = catMatch[1];
    if (sevMatch) details.severity = `${sevMatch[1]}/10`;
    if (deptMatch) details.department = deptMatch[1];
    else if (ruleDeptMatch) details.department = ruleDeptMatch[1];
    if (reasonMatch) details.reasoning = reasonMatch[1];
  } else if (body.includes('completed field work') || body.includes('claimed resolution')) {
    type = 'field_work';
    title = 'Field Work Completed';
    description = body;
  } else if (body.includes('Submitting before & after images to Gemini')) {
    type = 'verify_init';
    title = 'AI Verification Initiated';
    description = 'The branch uploaded an after photo. The zero-trust autonomous AI Agent is comparing the before and after images with Gemini Vision.';
  } else if (body.includes('AI Verification Agent completed analysis')) {
    type = 'verify_decision';
    title = 'AI Verification Audit';
    description = body;

    const verdictMatch = body.match(/Verdict:\s*'(.*?)'/);
    const confidenceMatch = body.match(/Confidence:\s*(\d+)%/);
    const reasonMatch = body.match(/Reasoning:\s*(.*)$/);

    if (verdictMatch) details.verdict = verdictMatch[1];
    if (confidenceMatch) details.confidence = Number(confidenceMatch[1]);
    if (reasonMatch) details.reasoning = reasonMatch[1];
  } else if (body.includes('error') || body.includes('failed') || body.includes('Zero-Trust') || body.includes('not configured') || body.includes('fallback')) {
    type = 'fallback_error';
    title = 'Audit Exception / Failover';
    description = body;
  } else {
    if (body.includes('verified the resolution')) {
      type = 'verify_decision';
      title = 'Citizen Verification';
      details.verdict = 'resolved';
    } else if (body.includes('rejected resolution claim')) {
      type = 'verify_decision';
      title = 'Citizen Rejection';
      details.verdict = 'not_resolved';
    } else {
      type = 'report';
      title = 'System Milestone';
    }
  }

  return { timestamp, originalText: step, type, title, description, details };
}

interface DashboardProps {
  tickets: Ticket[];
  departments: Department[];
  onRefreshTickets: () => Promise<void>;
  onReportIssue: () => void;
}

export default function Dashboard({
  tickets,
  departments,
  onRefreshTickets,
  onReportIssue
}: DashboardProps) {
  // Navigation & view states
  const [mobileMode, setMobileMode] = useState<'list' | 'map'>('list');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  // Interactive resolution upload state
  const [afterPhoto, setAfterPhoto] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false);

  // Get current active ticket details
  const selectedTicket = useMemo(() => {
    return tickets.find(t => t.id === selectedTicketId) || null;
  }, [tickets, selectedTicketId]);

  // Categories list
  const categoriesList = [
    { value: 'All', label: 'All Categories' },
    { value: 'pothole', label: 'Pothole & Road Damage' },
    { value: 'streetlight', label: 'Streetlight & Electrical' },
    { value: 'garbage', label: 'Trash & Illegal Dumping' },
    { value: 'water_leak', label: 'Water & Drainage Leak' }
  ];

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets
      .filter(ticket => {
        const matchesSearch =
          ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ticket.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ticket.department.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCategory = selectedCategory === 'All' || ticket.category === selectedCategory;
        const matchesStatus = selectedStatus === 'All' || ticket.status === selectedStatus;

        return matchesSearch && matchesCategory && matchesStatus;
      });
  }, [tickets, searchQuery, selectedCategory, selectedStatus]);

  // Handle marked resolved by department
  const handleResolveSubmit = async (ticketId: string) => {
    if (!afterPhoto) return;
    setIsSubmittingResolve(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_after_url: afterPhoto })
      });
      if (response.ok) {
        setAfterPhoto(null);
        await onRefreshTickets();
      } else {
        alert('Failed to submit resolution. Please try again.');
      }
    } catch (err) {
      console.error('Failed to resolve:', err);
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressing(true);
    try {
      const base64Img = await compressImage(file);
      setAfterPhoto(base64Img);
    } catch (err) {
      console.error(err);
      alert('Failed to process resolution photo.');
    } finally {
      setIsCompressing(false);
    }
  };

  return (
    <div id="dashboard-container" className="h-[calc(100vh-64px)] flex flex-col md:flex-row overflow-hidden bg-slate-50">
      
      {/* Search & Filters & Tickets Sidebar */}
      <div className={`w-full md:w-[420px] shrink-0 border-r border-slate-200 bg-white flex flex-col h-full ${mobileMode === 'map' ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Sidebar Header with Filters */}
        <div className="p-4 border-b border-slate-100 space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold text-slate-800 text-lg">Civic Issues Directory</h2>
            <button
              id="btn-sidebar-report"
              onClick={onReportIssue}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-md shadow-blue-500/10 cursor-pointer transition-all"
            >
              <Plus size={14} />
              Report Issue
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={14} />
            <input
              id="search-tickets"
              type="text"
              placeholder="Search description, department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 transition-all font-medium"
            />
          </div>

          {/* Dropdown Filters */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 text-left">Category</label>
              <select
                id="filter-category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none"
              >
                {categoriesList.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 text-left">Status</label>
              <select
                id="filter-status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Open">🔴 Open</option>
                <option value="Resolved Claimed">🟡 Resolved Claimed</option>
                <option value="Verified Resolved">🟢 Verified Resolved</option>
                <option value="Reopened">🟠 Reopened</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-400 font-bold">Showing {filteredTickets.length} results</span>
          </div>
        </div>

        {/* Tickets List Area */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredTickets.length === 0 ? (
            <div className="py-12 px-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400 border border-slate-100">
                <Search size={20} />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">No issues found</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                No tickets match your filter criteria. Submit a new report or adjust filters to begin.
              </p>
            </div>
          ) : (
            filteredTickets.map(ticket => {
              const isSelected = selectedTicketId === ticket.id;
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
                  onClick={() => {
                    setSelectedTicketId(ticket.id);
                    setAfterPhoto(null);
                  }}
                  className={`p-4 transition-all duration-200 cursor-pointer text-left hover:bg-slate-50/80 border-b border-slate-100 ${isSelected ? 'bg-blue-50/40 border-l-4 border-blue-600 pl-3' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${catMeta.bg}`}>
                      {catMeta.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${statusBg}`}>
                      {ticket.status}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-slate-800 line-clamp-2 mb-2 leading-relaxed">{ticket.description}</p>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>Severity {ticket.severity}/10 | {ticket.department}</span>
                    <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Map Viewer Panel */}
      <div className={`flex-1 h-full relative ${mobileMode === 'list' ? 'hidden md:block' : 'block'}`}>
        <TicketMap
          tickets={filteredTickets}
          selectedTicket={selectedTicket}
          onSelectTicket={(ticket) => setSelectedTicketId(ticket.id)}
        />

        {/* Floating Toggle View Button (Mobile only) */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 md:hidden z-[999] flex gap-1 bg-slate-900 text-white px-1.5 py-1.5 rounded-full shadow-2xl border border-white/10">
          <button
            onClick={() => setMobileMode('list')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${mobileMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            <span>List View</span>
          </button>
          <button
            onClick={() => setMobileMode('map')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${mobileMode === 'map' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            <span>Map View</span>
          </button>
        </div>
      </div>

      {/* Slide-over Ticket Details Panel */}
      {selectedTicket && (
        <div className="absolute inset-y-0 right-0 w-full md:w-[480px] bg-white border-l border-slate-200 shadow-2xl flex flex-col h-full z-[1001] animate-in slide-in-from-right duration-300">
          
          {/* Panel Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Issue Details</span>
              <span className="text-xs font-mono text-slate-400">ID: {selectedTicket.id.slice(0, 8)}</span>
            </div>
            <button
              id="btn-close-details"
              onClick={() => {
                setSelectedTicketId(null);
                setAfterPhoto(null);
              }}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full cursor-pointer transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Panel Body */}
          <div className="flex-1 overflow-y-auto pb-8">
            
            {/* Before and After Image Stage */}
            <div className="border-b border-slate-100 bg-slate-950">
              {selectedTicket.photo_after_url ? (
                <div className="grid grid-cols-2 gap-px bg-slate-800">
                  <div className="relative">
                    <img src={selectedTicket.photo_before_url} alt="Before" className="w-full aspect-video object-cover" />
                    <span className="absolute bottom-2 left-2 bg-rose-600 text-white font-black text-[9px] uppercase px-1.5 py-0.5 rounded">Before</span>
                  </div>
                  <div className="relative">
                    <img src={selectedTicket.photo_after_url} alt="After" className="w-full aspect-video object-cover" />
                    <span className="absolute bottom-2 left-2 bg-emerald-600 text-white font-black text-[9px] uppercase px-1.5 py-0.5 rounded font-medium">After / Resolution</span>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <img src={selectedTicket.photo_before_url} alt="Before" className="w-full aspect-video object-cover" />
                  <span className="absolute bottom-2 left-2 bg-rose-600 text-white font-black text-[9px] uppercase px-1.5 py-0.5 rounded">Before Photo</span>
                </div>
              )}
            </div>

            <div className="p-5 space-y-6">
              {/* Category, Status & Score badge */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getCategoryMeta(selectedTicket.category).bg}`}>
                  {getCategoryMeta(selectedTicket.category).label}
                </span>
                
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Status:</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-black border ${
                    selectedTicket.status === 'Verified Resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    selectedTicket.status === 'Resolved Claimed' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    selectedTicket.status === 'Reopened' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {selectedTicket.status}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider text-left">Citizen Description</h3>
                <p className="text-sm text-slate-700 leading-relaxed text-left font-medium whitespace-pre-line">{selectedTicket.description}</p>
              </div>

              {/* AI Details Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                <div className="text-left">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Department</span>
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1 mt-0.5">
                    <Building2 size={13} className="text-blue-500" />
                    {selectedTicket.department}
                  </span>
                </div>
                <div className="text-left">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">AI Severity Index</span>
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1 mt-0.5">
                    <Flame size={13} className="text-amber-500" />
                    {selectedTicket.severity} / 10
                  </span>
                </div>
                <div className="col-span-2 border-t border-slate-200/50 pt-2.5 text-left">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Coordinates</span>
                  <span className="text-xs font-mono text-slate-600 font-bold block mt-0.5">
                    {selectedTicket.lat.toFixed(6)}, {selectedTicket.lng.toFixed(6)}
                  </span>
                </div>
              </div>

              {/* Sequential AI Reasoning Log -> Styled Evidence Timeline */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider text-left flex items-center gap-1.5">
                    <Shield size={14} className="text-blue-500 animate-pulse" />
                    Evidence Timeline
                  </h3>
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-bold border border-blue-100/50">
                    Chronological Audit Trail
                  </span>
                </div>
                
                <div className="relative border-l border-slate-200 pl-5 ml-2.5 space-y-5 text-left">
                  {selectedTicket.reasoning_log?.map((rawStep, idx) => {
                    const step = parseLogStep(rawStep);
                    
                    // Determine Node Icon and Color styles
                    let iconBg = 'bg-slate-100 text-slate-500 border-slate-200';
                    let iconElement = <Clock size={11} />;
                    
                    switch (step.type) {
                      case 'report':
                        iconBg = 'bg-slate-100 text-slate-600 border-slate-200';
                        iconElement = <FileText size={11} />;
                        break;
                      case 'ai_init':
                        iconBg = 'bg-blue-50 text-blue-600 border-blue-200';
                        iconElement = <Cpu size={11} />;
                        break;
                      case 'ai_decision':
                        iconBg = 'bg-indigo-50 text-indigo-600 border-indigo-200';
                        iconElement = <Compass size={11} />;
                        break;
                      case 'field_work':
                        iconBg = 'bg-amber-50 text-amber-600 border-amber-200';
                        iconElement = <Building2 size={11} />;
                        break;
                      case 'verify_init':
                        iconBg = 'bg-purple-50 text-purple-600 border-purple-200';
                        iconElement = <Sparkles size={11} />;
                        break;
                      case 'verify_decision':
                        if (step.details?.verdict === 'resolved') {
                          iconBg = 'bg-emerald-50 text-emerald-600 border-emerald-200';
                          iconElement = <ShieldCheck size={11} />;
                        } else {
                          iconBg = 'bg-rose-50 text-rose-600 border-rose-200';
                          iconElement = <ShieldAlert size={11} />;
                        }
                        break;
                      case 'fallback_error':
                        iconBg = 'bg-rose-50 text-rose-600 border-rose-200';
                        iconElement = <AlertCircle size={11} />;
                        break;
                    }

                    return (
                      <div key={idx} className="relative group">
                        {/* Timeline Node dot */}
                        <span className="absolute -left-[29px] top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border bg-white shadow-sm z-10 transition-colors">
                          <span className={`w-full h-full rounded-full flex items-center justify-center ${iconBg}`}>
                            {iconElement}
                          </span>
                        </span>

                        {/* Step Card Wrapper */}
                        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-3.5 space-y-2 hover:bg-slate-50 transition-all duration-200">
                          {/* Header Line */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <span className="font-bold text-slate-800 text-xs tracking-tight">
                              {step.title}
                            </span>
                            {step.timestamp && (
                              <span className="text-[9px] font-mono font-bold text-slate-400 bg-white border border-slate-100 rounded px-1.5 py-0.5 shrink-0 self-start sm:self-center">
                                {step.timestamp}
                              </span>
                            )}
                          </div>

                          {/* Body Content Description */}
                          <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                            {step.description}
                          </p>

                          {/* Render Parsed Parameters */}
                          {Object.keys(step.details || {}).length > 0 && (
                            <div className="pt-2 border-t border-slate-200/40 grid grid-cols-1 gap-2">
                              {/* Classification Badges */}
                              {(step.details?.category || step.details?.severity || step.details?.department) && (
                                <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                                  {step.details.category && (
                                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold border border-indigo-100">
                                      Category: {step.details.category}
                                    </span>
                                  )}
                                  {step.details.severity && (
                                    <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-bold border border-amber-100">
                                      Severity: {step.details.severity}
                                    </span>
                                  )}
                                  {step.details.department && (
                                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-bold border border-blue-100">
                                      Routed: {step.details.department}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Verification verdict and confidence */}
                              {(step.details?.verdict || step.details?.confidence !== undefined) && (
                                <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-bold">
                                  {step.details.verdict && (
                                    <span className={`px-2 py-0.5 rounded-md border ${
                                      step.details.verdict === 'resolved' 
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                        : 'bg-rose-50 text-rose-700 border-rose-100'
                                    }`}>
                                      Verdict: {step.details.verdict === 'resolved' ? '✅ Resolved' : '❌ Rejected/Reopened'}
                                    </span>
                                  )}
                                  {step.details.confidence !== undefined && (
                                    <span className={`px-2 py-0.5 rounded-md border ${
                                      step.details.confidence > 70 
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                        : 'bg-rose-50 text-rose-700 border-rose-100'
                                    }`}>
                                      Confidence: {step.details.confidence}%
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Extra Reasoning Block quote style */}
                              {step.details?.reasoning && (
                                <div className="bg-white border border-slate-100 rounded-xl p-2.5 text-[10px] text-slate-500 font-medium leading-relaxed italic block">
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block not-italic mb-0.5">AI Agent Analysis:</span>
                                  "{step.details.reasoning}"
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Interactive Lifecycle Workflows */}
              <div className="border-t border-slate-100 pt-6 space-y-4 text-left">
                {/* Workflow 1: Open or Reopened -> Mark as Resolved Claimed (Department Panel) */}
                {(selectedTicket.status === 'Open' || selectedTicket.status === 'Reopened') && (
                  <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-1.5 text-blue-800 font-bold text-xs">
                      <Building2 size={15} />
                      <span>Department Action: Claim Field Resolution</span>
                    </div>
                    <p className="text-[11px] text-blue-600 leading-relaxed font-medium">
                      If you are dispatching from <strong>{selectedTicket.department}</strong>, complete the maintenance in the field, take an "after" photo of the site, and upload it here to claim resolution.
                    </p>

                    {afterPhoto ? (
                      <div className="relative rounded-xl overflow-hidden aspect-video border border-blue-200">
                        <img src={afterPhoto} alt="Resolution" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setAfterPhoto(null)}
                          className="absolute top-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white p-1 rounded-full cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-blue-200 bg-white hover:border-blue-400 rounded-xl px-4 py-4 cursor-pointer transition-colors w-full">
                          <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                          <span className="text-xs font-bold text-blue-600">Select Resolution Photo</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">Required for resolve claim</span>
                        </label>
                      </div>
                    )}

                    <button
                      onClick={() => handleResolveSubmit(selectedTicket.id)}
                      disabled={!afterPhoto || isSubmittingResolve}
                      className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      {isSubmittingResolve ? 'Submitting Resolve Claim...' : 'Mark Resolved & Claim Score'}
                    </button>
                  </div>
                )}

                {/* Workflow 2: Autonomous Verification Agent in Progress */}
                {selectedTicket.status === 'Resolved Claimed' && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 flex items-start gap-3">
                    <ShieldCheck size={18} className="shrink-0 mt-0.5 animate-pulse" />
                    <div className="text-xs">
                      <span className="font-bold block flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        Autonomous Verification In Progress...
                      </span>
                      <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-slate-700">
                        The autonomous AI Verification Agent is comparing the before and after photos using Gemini Vision. Decisions are evaluated in real-time under a zero-trust policy.
                      </p>
                    </div>
                  </div>
                )}

                {/* Workflow 3: Verified Resolved Outcome */}
                {selectedTicket.status === 'Verified Resolved' && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-start gap-3">
                    <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-bold block">Verified Resolved by AI Agent</span>
                      <p className="mt-0.5 text-[11px] font-medium leading-relaxed">
                        The autonomous Verification Agent confirmed the repair. A trust score bonus of <strong>+2</strong> has been successfully credited to {selectedTicket.department}.
                      </p>
                    </div>
                  </div>
                )}

                {/* Workflow 4: Reopened Outcome Info */}
                {selectedTicket.status === 'Reopened' && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-start gap-3">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-bold block">Reopened by AI Agent</span>
                      <p className="mt-0.5 text-[11px] font-medium leading-relaxed font-semibold text-rose-800">
                        The autonomous Verification Agent rejected the resolution proof or confidence was too low. Trust rating subtracted <strong>-5</strong> from {selectedTicket.department}. The ticket has been routed back to the queue for priority re-dispatch.
                      </p>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      )}
    </div>
  );
}
