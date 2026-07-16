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
  // --- Auth ---
  const [token, setToken] = useState(() => localStorage.getItem('sl_token') || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [loginMsg, setLoginMsg] = useState('');
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState('start');
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('');
  const [leadTarget, setLeadTarget] = useState(50);
  const [isLaunched, setIsLaunched] = useState(false);
  const [bounceBackEnabled, setBounceBackEnabled] = useState(false);
  const [bouncebackLogs, setBouncebackLogs] = useState([]);
  const [progress, setProgress] = useState({ scraper: 0, strategist: 0, writer: 0 });
  const [leads, setLeads] = useState([]);
  const [leadStats, setLeadStats] = useState({ total: 0, verified: 0, highIntent: 0 });
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState('idle'); // idle | running | strategizing | complete | error
  const [jobId, setJobId] = useState(null);
  const [error, setError] = useState('');
  const [selectedLead, setSelectedLead] = useState(null); // for script modal

  // --- Subscription + outreach + usage ---
  const [usage, setUsage] = useState(null); // { leadsUsed, allowance, remaining, fraction, resetsAt }
  const [addonPrice, setAddonPrice] = useState(null); // { tier, amount } — the REAL price they'd pay
  const [addonPending, setAddonPending] = useState(false);
  const [subscription, setSubscription] = useState({ status: 'inactive' });
  const [subscribing, setSubscribing] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]); // leads chosen for push
  const [pushing, setPushing] = useState(false);
  const [pushMsg, setPushMsg] = useState('');

  const persistToken = (t) => { localStorage.setItem('sl_token', t); setToken(t); };
  const clearToken = () => { localStorage.removeItem('sl_token'); setToken(''); setCurrentUser(null); };

  // Authed fetch wrapper: attaches the Bearer token and logs out on 401.
  const apiFetch = async (path, opts = {}) => {
    const res = await fetch(path, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.status === 401) { clearToken(); throw new Error('Your session expired. Please sign in again.'); }
    return res;
  };

  // Bootstrap: handle the BounceBack login callback, or validate a stored session.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cbToken = params.get('token');
    if (cbToken) {
      // Landed from BounceBack's magic-link redirect — exchange for a session.
      fetch('/api/auth/exchange', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cbToken }),
      })
        .then((r) => r.json())
        .then((d) => { if (d.token) { persistToken(d.token); setCurrentUser(d.user); } })
        .catch(() => {})
        .finally(() => { window.history.replaceState({}, '', '/'); setAuthChecking(false); });
      return;
    }
    if (token) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d && d.user) setCurrentUser(d.user); else clearToken(); })
        .catch(() => clearToken())
        .finally(() => setAuthChecking(false));
    } else {
      setAuthChecking(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadUsage = () =>
    apiFetch('/api/usage').then((r) => r.json()).then(setUsage).catch(() => {});

  // Once authenticated, load subscription + add-on status + monthly usage.
  useEffect(() => {
    if (!currentUser) return;
    apiFetch('/api/billing/status').then((r) => r.json()).then(setSubscription).catch(() => {});
    apiFetch('/api/bounceback/status').then((r) => r.json())
      .then((d) => { setBounceBackEnabled(!!d.addonActive); setAddonPrice(d.price ?? null); })
      .catch(() => {});
    loadUsage();
  }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async (e) => {
    e?.preventDefault?.();
    setLoginPending(true); setLoginError(''); setLoginMsg('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      if (data.token) { persistToken(data.token); setCurrentUser(data.user); }
      else if (data.magicLink) setLoginMsg(data.message || 'Check your email for a sign-in link.');
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginPending(false);
    }
  };

  const handleLogout = () => { clearToken(); setLeads([]); setActiveTab('start'); };

  const loadLeads = async () => {
    setLeadsLoading(true);
    try {
      const data = await apiFetch('/api/leads').then((r) => r.json());
      if (data.leads) setLeads(data.leads);
      if (data.stats) setLeadStats(data.stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setLeadsLoading(false);
    }
  };

  // Poll real job status while a scrape is in flight. Progress bars are driven
  // by the job's actual stage/status, not client-side guesswork.
  useEffect(() => {
    if (!jobId) return;
    if (scrapeStatus !== 'running' && scrapeStatus !== 'strategizing') return;

    const progressForStage = (stage) => {
      switch (stage) {
        case 'SCRAPER': return { scraper: 60, strategist: 0, writer: 0 };
        case 'STRATEGIST': return { scraper: 100, strategist: 60, writer: 0 };
        case 'WRITER': return { scraper: 100, strategist: 100, writer: 60 };
        case 'DONE': return { scraper: 100, strategist: 100, writer: 100 };
        default: return { scraper: 20, strategist: 0, writer: 0 };
      }
    };

    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/scrape/${jobId}`);
        if (!res.ok) return;
        const job = await res.json();

        setProgress(progressForStage(job.stage));
        setScrapeStatus(job.stage === 'STRATEGIST' || job.stage === 'WRITER' ? 'strategizing' : 'running');

        if (job.status === 'SUCCEEDED') {
          setProgress({ scraper: 100, strategist: 100, writer: 100 });
          setScrapeStatus('complete');
          await loadLeads();
          loadUsage(); // leads just consumed part of the monthly allowance
        } else if (job.status === 'FAILED') {
          setScrapeStatus('error');
          setError(job.error || 'The scrape job failed');
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [jobId, scrapeStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch leads when switching to the leads tab
  useEffect(() => {
    if (activeTab === 'leads' && currentUser) loadLeads();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBounceLogs = async () => {
    try {
      const data = await apiFetch('/api/bounceback/logs').then((r) => r.json());
      if (data.logs) setBouncebackLogs(data.logs);
    } catch (err) {
      console.error('Failed to fetch bounceback logs:', err);
    }
  };

  // Start the $9.99 add-on purchase on BounceBack (redirects to its checkout).
  const handleActivateBounceback = async () => {
    setError('');
    setAddonPending(true);
    try {
      const { url, stubbed } = await apiFetch('/api/bounceback/addon-checkout', { method: 'POST' }).then((r) => r.json());
      if (stubbed) { setBounceBackEnabled(true); fetchBounceLogs(); }
      else if (url) window.location.href = url;
    } catch (err) {
      setError(err.message);
    } finally {
      setAddonPending(false);
    }
  };

  // Fetch bounceback logs periodically when the add-on is active
  useEffect(() => {
    if (!bounceBackEnabled || !currentUser) return;
    fetchBounceLogs();
    const interval = setInterval(fetchBounceLogs, 5000);
    return () => clearInterval(interval);
  }, [bounceBackEnabled, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubscribe = async () => {
    setSubscribing(true); setError('');
    try {
      const { url } = await apiFetch('/api/billing/checkout', { method: 'POST' }).then((r) => r.json());
      if (url && url.startsWith('http') && !url.startsWith(window.location.origin)) window.location.href = url;
      else { const s = await apiFetch('/api/billing/status').then((r) => r.json()); setSubscription(s); }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubscribing(false);
    }
  };

  const toggleSelect = (id) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handlePush = async () => {
    if (selectedIds.length === 0) return;
    setPushing(true); setPushMsg(''); setError('');
    try {
      const res = await apiFetch('/api/outreach/push', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: selectedIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Push failed');
      setPushMsg(`Pushed ${data.queued} lead${data.queued === 1 ? '' : 's'} to BounceBack SMS outreach.`);
      setSelectedIds([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setPushing(false);
    }
  };

  const handleDownloadCsv = async () => {
    try {
      const res = await apiFetch('/api/leads/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'swarmleads-leads.csv';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLaunch = async () => {
    setIsLaunched(true);
    setActiveTab('command');
    setScrapeStatus('running');
    setProgress({ scraper: 0, strategist: 0, writer: 0 });
    setJobId(null);
    setError('');

    try {
      const res = await apiFetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry, region, target: effectiveTarget }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to launch Worker Bees');
      }

      const data = await res.json();
      if (!data.jobId) throw new Error('Server did not return a job id');
      setJobId(data.jobId);
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

  // What the backend will ACTUALLY deliver: bounded by the per-search cap and by
  // whatever is left of the monthly allowance. Keeps the slider honest.
  const searchCap = usage?.perSearchCap ?? 50;
  const allowanceSpent = !!usage && usage.remaining <= 0;
  const effectiveTarget = Math.min(
    leadTarget,
    searchCap,
    usage ? Math.max(usage.remaining, 0) : searchCap
  );

  // --- Login gate ---
  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/30">
        <div className="text-gray-400 font-bold animate-pulse">Loading…</div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/30 p-6">
        <div className="w-full max-w-md bg-white p-10 rounded-[2rem] shadow-xl shadow-gray-100 border border-gray-50">
          <h1 className="text-3xl font-black tracking-tighter text-brand-blue flex items-center gap-2 mb-2">
            <Zap className="fill-brand-blue" /> SwarmLeads
          </h1>
          <p className="text-gray-500 font-medium mb-8">Sign in with your BounceBack account to continue.</p>
          {loginMsg ? (
            <div className="bg-green-50 border-2 border-green-200 text-green-700 p-6 rounded-2xl font-bold">{loginMsg}</div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="label-text">Email</label>
                <input
                  type="email" required value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="input-field bg-gray-50/50"
                />
              </div>
              {loginError && (
                <div className="bg-red-50 border-2 border-red-200 text-red-700 p-4 rounded-xl font-bold text-sm">{loginError}</div>
              )}
              <button type="submit" disabled={loginPending || !loginEmail}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                {loginPending ? 'Signing in…' : 'Sign In'}
                <ChevronRight />
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

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

        <div className="p-6 mt-auto border-t border-gray-50 space-y-4">
          {/* Monthly lead allowance — transparent so the cap feels generous, not punitive */}
          {usage && (
            <div className="bg-gray-50 p-4 rounded-xl">
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Leads this month</p>
                <span className="text-xs font-black text-gray-600">
                  {usage.leadsUsed.toLocaleString()}/{usage.allowance.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    usage.fraction >= 1 ? 'bg-red-500'
                      : usage.fraction >= 0.8 ? 'bg-orange-400'
                      : 'bg-brand-blue'
                  )}
                  style={{ width: `${Math.round(usage.fraction * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs font-bold text-gray-400">
                {usage.remaining > 0
                  ? `${usage.remaining.toLocaleString()} left · resets ${new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                  : `Allowance used · resets ${new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
              </p>
            </div>
          )}

          <div className="bg-blue-50 p-4 rounded-xl">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Your Account</p>
            <p className="text-sm font-black text-brand-dark truncate" title={currentUser?.email}>{currentUser?.email}</p>
            {subscription.status === 'active' || subscription.status === 'trialing' ? (
              <p className="text-lg font-black text-brand-blue mt-1">
                ${subscription.checkoutPrice?.amount ?? '29.99'}
                <span className="text-xs font-normal text-blue-400">/mo · {subscription.status}</span>
              </p>
            ) : (
              <button onClick={handleSubscribe} disabled={subscribing}
                className="mt-2 w-full bg-brand-blue text-white text-sm font-black py-2 rounded-lg hover:scale-[1.02] transition-all disabled:opacity-50">
                {subscribing ? 'Starting…' : `Subscribe · $${subscription.checkoutPrice?.amount ?? '29.99'}/mo`}
              </button>
            )}
            {subscription.checkoutPrice?.tier === 'addon'
              && subscription.status !== 'active' && subscription.status !== 'trialing' && (
              <p className="mt-2 text-xs font-bold text-gray-400">
                Add-on price — bundled with your BounceBack plan.
              </p>
            )}
            <button onClick={handleLogout} className="mt-3 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 ml-72 p-12">
        {/* Global error toast (surfaces previously-swallowed API errors) */}
        {error && (
          <div className="max-w-4xl mx-auto mb-6 bg-red-50 border-2 border-red-200 text-red-700 px-6 py-4 rounded-2xl font-bold flex items-center justify-between gap-4">
            <span>Error: {error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><X size={18} /></button>
          </div>
        )}
        {pushMsg && (
          <div className="max-w-4xl mx-auto mb-6 bg-green-50 border-2 border-green-200 text-green-700 px-6 py-4 rounded-2xl font-bold flex items-center justify-between gap-4">
            <span>{pushMsg}</span>
            <button onClick={() => setPushMsg('')} className="text-green-400 hover:text-green-600"><X size={18} /></button>
          </div>
        )}
        {activeTab === 'start' && (
          <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-12">
              <h2 className="text-5xl font-black text-brand-dark mb-4">Start Project</h2>
              <p className="text-xl text-gray-500 font-medium">Full unlimited access for just <span className="text-brand-blue font-black">${subscription.checkoutPrice?.amount ?? '29.99'}/month.</span></p>
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
                  <label className="label-text mb-0">Leads for this search</label>
                  <span className="text-3xl font-black text-brand-blue">{effectiveTarget}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max={searchCap}
                  step="5"
                  value={Math.min(leadTarget, searchCap)}
                  onChange={(e) => setLeadTarget(parseInt(e.target.value))}
                  className="w-full h-3 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-brand-blue"
                />
                <p className="mt-4 text-gray-500 font-bold">
                  {usage && usage.remaining < leadTarget && usage.remaining > 0 ? (
                    <>Limited to <span className="text-brand-dark">{usage.remaining}</span> — that's all that's left in this month's allowance.</>
                  ) : (
                    <>Worker Bees assigned to this search: <span className="text-brand-dark">{Math.max(1, Math.ceil(effectiveTarget / 10))}</span></>
                  )}
                </p>
              </div>

              {allowanceSpent && (
                <div className="bg-orange-50 border-2 border-orange-200 text-orange-700 p-5 rounded-2xl font-bold">
                  You've used all {usage.allowance.toLocaleString()} leads in this month's allowance.
                  It resets on {new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}.
                </div>
              )}

              <button
                onClick={handleLaunch}
                disabled={!industry || !region || allowanceSpent}
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
              <div className="flex items-center gap-3">
                {selectedIds.length > 0 && (
                  <button
                    onClick={handlePush}
                    disabled={pushing}
                    className="flex items-center gap-2 px-6 py-3 bg-brand-blue text-white rounded-xl font-bold hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    <MessageSquare size={20} />
                    {pushing ? 'Pushing…' : `Push ${selectedIds.length} to SMS Outreach`}
                  </button>
                )}
                <button
                  onClick={handleDownloadCsv}
                  disabled={leads.length === 0}
                  className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-100 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  <Download size={20} />
                  Download CSV (Excel)
                </button>
              </div>
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
                      onClick={handleActivateBounceback}
                      disabled={addonPending}
                      className="bg-brand-blue text-white font-black py-4 px-8 rounded-2xl text-xl shadow-xl shadow-blue-100 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                      {addonPending ? 'Starting…' : 'Add Missed-Call Protection'}
                      {addonPrice && (
                        <span className="text-blue-200 text-sm font-bold">+${addonPrice.amount}/mo</span>
                      )}
                    </button>
                    {/* Show the discount line ONLY when they actually qualify for
                        the add-on rate — never advertise $9.99 then charge $29.99. */}
                    {addonPrice?.tier === 'addon' ? (
                      <p className="text-sm text-gray-400 font-bold max-w-[170px]">
                        <span className="line-through">$29.99/mo</span> — bundled with your SwarmLeads plan
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 font-bold max-w-[190px]">
                        Already on SwarmLeads? Adding it drops this to <span className="text-brand-blue">$9.99/mo</span>.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Table */}
            {leadsLoading && leads.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 text-center">
                <div className="w-12 h-12 border-4 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin mx-auto mb-6" />
                <p className="text-gray-400 font-bold">Loading your leads…</p>
              </div>
            ) : leads.length > 0 ? (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="p-6 border-b border-gray-100 w-12">
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-brand-blue cursor-pointer"
                          checked={leads.length > 0 && selectedIds.length === leads.length}
                          onChange={(e) => setSelectedIds(e.target.checked ? leads.map((l) => l.id) : [])}
                        />
                      </th>
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
                        <td className="p-6">
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-brand-blue cursor-pointer"
                            checked={selectedIds.includes(lead.id)}
                            onChange={() => toggleSelect(lead.id)}
                          />
                        </td>
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

            {/* BounceBack Activity Section */}
            {bounceBackEnabled && (
              <div className="mt-12 animate-in fade-in duration-500">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-brand-dark flex items-center gap-3">
                      <Phone className="text-green-500" size={24} />
                      BounceBack Activity
                    </h3>
                    <p className="text-gray-500 font-medium mt-1">Live missed-call text-back logs from BounceBack</p>
                  </div>
                  <span className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-full font-bold text-sm">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                    </span>
                    Add-on active
                  </span>
                </div>
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  {bouncebackLogs.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {bouncebackLogs.map((log) => (
                        <div key={log.id} className="p-6 hover:bg-gray-50/30 transition-colors">
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                              <Phone size={18} className="text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-bold text-gray-800">Missed call from {log.incoming_number}</span>
                                <span className="text-xs text-gray-400">{log.created_at}</span>
                              </div>
                              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                  <MessageSquare size={12} />
                                  Auto-reply sent
                                </div>
                                <p className="text-gray-700 font-medium whitespace-pre-line">{log.outgoing_text}</p>
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-bold">Delivered</span>
                                <span className="text-xs text-gray-400">via SwarmLeads SMS Worker</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-12 text-center">
                      <Phone className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                      <h4 className="text-lg font-black text-gray-400 mb-2">No missed calls yet</h4>
                      <p className="text-gray-400 font-medium">Missed calls to your BounceBack number will appear here automatically.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
