import React, { useState, useEffect } from 'react';
import {
  Rocket,
  LayoutDashboard,
  Users,
  ChevronRight,
  Download,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Mail,
  Zap,
  Menu,
  X,
  MessageSquare,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const INDUSTRIES = [
  "Roofing", 
  "Plumbing", 
  "HVAC", 
  "Electrical", 
  "Landscaping", 
  "General Contracting"
];

export default function App() {
  const [activeTab, setActiveTab] = useState('start');
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('');
  const [leadTarget, setLeadTarget] = useState(100);
  const [isLaunched, setIsLaunched] = useState(false);
  const [bounceBackEnabled, setBounceBackEnabled] = useState(false);
  const [progress, setProgress] = useState({ scraper: 0, strategist: 0, writer: 0 });
  const [leads, setLeads] = useState([]);
  const [leadStats, setLeadStats] = useState({ total: 0, verified: 0, highIntent: 0 });
  const [scrapeStatus, setScrapeStatus] = useState('idle'); // idle | running | strategizing | complete | error
  const [error, setError] = useState('');
  const [selectedLead, setSelectedLead] = useState(null); // for script modal

  // Poll for leads when scraping is running
  useEffect(() => {
    if (scrapeStatus !== 'running') return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/leads');
        const data = await res.json();
        
        if (data.leads) {
          setLeads(data.leads);
          if (data.stats) setLeadStats(data.stats);
        }
        
        if (data.leads && data.leads.length > 0) {
          setProgress(prev => ({
            scraper: Math.min(100, prev.scraper + 20),
            strategist: Math.min(90, prev.strategist + 10),
            writer: Math.min(30, prev.writer + 3)
          }));
        }
        
        // Mark strategizing once we have leads but strategist hasn't finished
        if (data.leads && data.leads.length >= Math.min(leadTarget, 50)) {
          setScrapeStatus('strategizing');
        }

        // Mark complete when strategist has processed all leads
        if (data.stats && data.stats.verified + data.stats.highIntent >= data.stats.total * 0.3 && data.stats.total > 0) {
          setScrapeStatus('complete');
          setProgress({ scraper: 100, strategist: 100, writer: 100 });
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [scrapeStatus, leadTarget]);

  // Fetch leads when switching to the leads tab
  useEffect(() => {
    if (activeTab === 'leads') {
      fetch('/api/leads')
        .then(res => res.json())
        .then(data => {
          if (data.leads) setLeads(data.leads);
          if (data.stats) setLeadStats(data.stats);
        })
        .catch(() => {});
    }
  }, [activeTab]);

  const handleLaunch = async () => {
    setIsLaunched(true);
    setActiveTab('command');
    setScrapeStatus('running');
    setError('');
    
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry, region, target: leadTarget }),
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to launch Worker Bees');
      }
    } catch (err) {
      setError(err.message);
      setScrapeStatus('error');
    }
  };

  const navItems = [
    { id: 'start', label: '1. Start Project', icon: Rocket },
    { id: 'command', label: '2. Command Center', icon: LayoutDashboard },
    { id: 'leads', label: '3. Your Leads', icon: Users },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50/30">
      {/* Sidebar */}
      <div className="w-72 bg-white border-r border-gray-100 flex flex-col fixed inset-y-0 shadow-sm z-20">
        <div className="p-8">
          <h1 className="text-2xl font-black tracking-tighter text-brand-blue flex items-center gap-2">
            <Zap className="fill-brand-blue" />
            SwarmLeads
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-4 rounded-xl font-bold transition-all",
                activeTab === item.id 
                  ? "bg-brand-blue text-white shadow-blue-200 shadow-lg scale-[1.02]" 
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              )}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-6 mt-auto border-t border-gray-50">
          <div className="bg-blue-50 p-4 rounded-xl">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Your Account</p>
            <p className="text-sm font-black text-brand-dark">Active Subscription</p>
            <p className="text-lg font-black text-brand-blue mt-1">$29.99<span className="text-xs font-normal text-blue-400">/mo</span></p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 ml-72 p-12">
        {activeTab === 'start' && (
          <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-12">
              <h2 className="text-5xl font-black text-brand-dark mb-4">Start Project</h2>
              <p className="text-xl text-gray-500 font-medium">Full unlimited access for just <span className="text-brand-blue font-black">$29.99/month.</span></p>
            </div>

            <div className="space-y-8 bg-white p-12 rounded-[2rem] shadow-xl shadow-gray-100 border border-gray-50">
              <div>
                <label className="label-text">What is your industry?</label>
                <select 
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="input-field appearance-none bg-gray-50/50"
                >
                  <option value="">Select your industry...</option>
                  {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </div>

              <div>
                <label className="label-text">What city or region do you service?</label>
                <input 
                  type="text"
                  placeholder="e.g., Oakland, CA"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="input-field bg-gray-50/50"
                />
              </div>

              <div>
                <div className="flex justify-between items-end mb-4">
                  <label className="label-text mb-0">Weekly Lead Target</label>
                  <span className="text-3xl font-black text-brand-blue">{leadTarget}</span>
                </div>
                <input 
                  type="range"
                  min="50"
                  max="500"
                  step="10"
                  value={leadTarget}
                  onChange={(e) => setLeadTarget(parseInt(e.target.value))}
                  className="w-full h-3 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-brand-blue"
                />
                <p className="mt-4 text-gray-500 font-bold">
                  Estimated Worker Bees assigned to your project: <span className="text-brand-dark">{Math.floor(leadTarget / 10)}</span>
                </p>
              </div>

              <button 
                onClick={handleLaunch}
                disabled={!industry || !region}
                className="btn-primary w-full mt-4 flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:scale-100"
              >
                Launch Worker Bees
                <ChevronRight />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'command' && (
          <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
            <div className="mb-12">
              <h2 className="text-5xl font-black text-brand-dark mb-4">Command Center</h2>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-full font-bold">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                Project Status: Active and Processing
              </div>
              <p className="text-xl text-gray-500 mt-4 font-medium">
                Mining data for <span className="text-brand-blue font-black">{industry || 'Your Business'}</span> in <span className="text-brand-blue font-black">{region || 'Your Region'}</span>
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-700 p-6 rounded-2xl mb-6 font-bold">
                Error: {error}
              </div>
            )}
            <div className="space-y-6">
              {[
                { name: 'Scraper Bee', label: 'Scanning local business registries, maps, and permit data...', value: progress.scraper, color: 'bg-blue-500' },
                { name: 'Strategist Bee', label: 'Structuring personalized local outreach angles...', value: progress.strategist, color: 'bg-indigo-500' },
                { name: 'Writer Bee', label: 'Tailoring customized message scripts...', value: progress.writer, color: 'bg-purple-500' },
              ].map((bee) => (
                <div key={bee.name} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-black text-brand-dark">{bee.name}</h3>
                    <span className="text-lg font-black text-gray-400">{bee.value}%</span>
                  </div>
                  <p className="text-gray-500 font-medium mb-6">{bee.label}</p>
                  <div className="w-full h-4 bg-gray-50 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full transition-all duration-500 ease-out rounded-full", bee.color)} 
                      style={{ width: `${bee.value}%` }}
                    />
                  </div>
                </div>
              ))}

              <div className="bg-brand-dark text-white p-8 rounded-2xl flex items-start gap-4">
                <CheckCircle2 className="text-blue-400 shrink-0" />
                <div>
                  <h4 className="text-lg font-bold">Hidden AI workforce active</h4>
                  <p className="text-gray-400 font-medium">Your project is running 24/7 in the background. No manual configuration required. We'll notify you as soon as the first batch is ready.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leads' && (
          <div className="animate-in fade-in duration-500">
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-5xl font-black text-brand-dark mb-4">Your Leads</h2>
                <p className="text-xl text-gray-500 font-medium">Fresh opportunities delivered to your dashboard.</p>
              </div>
              <button className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-100 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all">
                <Download size={20} />
                Download CSV (Excel)
              </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              {[
                { label: 'Total Leads Extracted', value: leadStats.total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Verified Connections', value: leadStats.verified, icon: Phone, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'High-Intent Matches', value: leadStats.highIntent, icon: Zap, color: 'text-orange-600', bg: 'bg-orange-50' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6", stat.bg)}>
                    <stat.icon className={stat.color} size={24} />
                  </div>
                  <p className="text-gray-500 font-bold uppercase tracking-wider text-xs mb-2">{stat.label}</p>
                  <p className="text-4xl font-black text-brand-dark">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* BounceBack SMS Banner */}
            {!bounceBackEnabled && (
              <div className="bg-white border-4 border-brand-blue/20 rounded-3xl p-10 mb-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Phone size={120} className="text-brand-blue" />
                </div>
                <div className="relative z-10 max-w-2xl">
                  <div className="flex items-center gap-3 text-orange-500 font-black uppercase tracking-widest mb-4">
                    <AlertTriangle size={20} />
                    Warning: More Leads Means More Phone Calls
                  </div>
                  <h3 className="text-3xl font-black text-brand-dark mb-4">Don't Lose Revenue to a Missed Call.</h3>
                  <p className="text-lg text-gray-500 font-medium mb-8 leading-relaxed">
                    Your business is about to get flooded with new leads. If you are out in the field and miss an incoming call, that client will call your competitor next. 
                    <span className="text-brand-blue font-bold"> Lock in the job instantly.</span>
                  </p>
                  <div className="flex items-center gap-6">
                    <button 
                      onClick={() => setBounceBackEnabled(true)}
                      className="bg-brand-blue text-white font-black py-4 px-8 rounded-2xl text-xl shadow-xl shadow-blue-100 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                    >
                      Add Missed-Call Protection
                      <span className="text-blue-200 text-sm font-bold">+$9.99/mo</span>
                    </button>
                    <p className="text-sm text-gray-400 font-bold max-w-[150px]">Normally $29.99/mo - Limited Time Deal</p>
                  </div>
                </div>
              </div>
            )}

            {/* Table */}
            {leads.length > 0 ? (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Business Name</th>
                      <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Contact Person</th>
                      <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Phone Number</th>
                      <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Email Address</th>
                      <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">AI Custom Angle</th>
                      <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Script</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50/30 transition-colors group">
                        <td className="p-6 font-black text-brand-dark">{lead.business_name}</td>
                        <td className="p-6 font-bold text-gray-600">{lead.contact_person}</td>
                        <td className="p-6 font-bold text-gray-600">{lead.phone}</td>
                        <td className="p-6 font-medium text-blue-600 underline underline-offset-4">{lead.email}</td>
                        <td className="p-6">
                          <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-brand-blue rounded-lg text-sm font-bold">
                            <Zap size={14} className="fill-brand-blue" />
                            {lead.angle}
                          </span>
                        </td>
                        <td className="p-6 text-center">
                          <button
                            onClick={() => setSelectedLead(lead)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-xs font-bold transition-colors"
                          >
                            <MessageSquare size={14} />
                            {lead.outreach_script ? 'View Draft' : 'Generate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 text-center">
                <Users className="w-16 h-16 text-gray-200 mx-auto mb-6" />
                <h3 className="text-2xl font-black text-gray-400 mb-2">No leads yet</h3>
                <p className="text-gray-400 font-medium">Start a project and deploy Worker Bees to populate your leads.</p>
              </div>
            )}

            {/* Script Modal */}
            {selectedLead && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelectedLead(null)}>
                <div className="bg-white rounded-3xl max-w-2xl w-full mx-6 max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between p-8 border-b border-gray-100">
                    <div>
                      <h3 className="text-xl font-black text-brand-dark">{selectedLead.business_name}</h3>
                      <p className="text-sm text-gray-500 font-medium mt-1">Outreach Script Draft</p>
                    </div>
                    <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                      <X size={20} className="text-gray-400" />
                    </button>
                  </div>
                  <div className="p-8">
                    {selectedLead.outreach_script ? (
                      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                        <div className="flex items-center gap-2 mb-4 text-gray-500 text-xs font-bold uppercase tracking-wider">
                          <MessageSquare size={14} />
                          SMS Preview
                        </div>
                        <p className="text-gray-800 leading-relaxed whitespace-pre-line font-medium">
                          {selectedLead.outreach_script}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-500 font-medium">No script generated yet.</p>
                        <p className="text-gray-400 text-sm mt-1">Run the Writer Bee to generate a personalized outreach script.</p>
                      </div>
                    )}
                    <div className="mt-6 flex items-center gap-3 text-xs text-gray-400">
                      <Phone size={14} />
                      <span>Send via SMS • {selectedLead.phone}</span>
                    </div>
                  </div>
                  <div className="p-6 bg-gray-50 rounded-b-3xl border-t border-gray-100 flex justify-end gap-3">
                    <button onClick={() => setSelectedLead(null)} className="px-6 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-white transition-colors text-sm">
                      Close
                    </button>
                    {selectedLead.outreach_script && (
                      <button className="px-6 py-3 bg-brand-blue text-white rounded-xl font-bold hover:bg-blue-700 transition-colors text-sm flex items-center gap-2">
                        <MessageSquare size={16} />
                        Copy Script
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
