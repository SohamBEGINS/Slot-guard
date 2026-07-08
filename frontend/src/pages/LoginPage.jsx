import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield, ArrowRight, Clock, Plus, LogOut, CheckCircle2,
    Rocket, Terminal, Trash2, Loader2, Eye, EyeOff, Mail, Lock, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '../lib/supabaseClient';
import logo from '../assets/logo_transparent.png';

// ─── Password strength checker ────────────────────────────────────────────────
function getPasswordStrength(password) {
    if (!password) return { score: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 8)  score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { score, label: 'Weak',   color: 'bg-red-500' };
    if (score <= 2) return { score, label: 'Fair',   color: 'bg-orange-500' };
    if (score <= 3) return { score, label: 'Good',   color: 'bg-yellow-500' };
    if (score <= 4) return { score, label: 'Strong', color: 'bg-emerald-400' };
    return              { score, label: 'Very Strong', color: 'bg-emerald-500' };
}

function PasswordStrengthBar({ password }) {
    const { score, label, color } = getPasswordStrength(password);
    if (!password) return null;
    return (
        <div className="space-y-1.5 mt-2">
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                    <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? color : 'bg-white/10'}`}
                    />
                ))}
            </div>
            <p className={`text-xs font-mono font-bold ${score <= 1 ? 'text-red-400' : score <= 2 ? 'text-orange-400' : score <= 3 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                {label}
            </p>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LoginPage() {
    const navigate = useNavigate();

    // ── Auth state ────────────────────────────────────────────────────────────
    const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup' | 'verify'
    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState(''); // for signup only
    const [showPassword, setShowPassword] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError]     = useState(null);

    // ── Dashboard state (unchanged from original) ────────────────────────────
    const [username, setUsername]   = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [pastRuns, setPastRuns]   = useState([]);
    const [loading, setLoading]     = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError]         = useState(null);

    // ── On mount: check active Supabase session ───────────────────────────────
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                handleSessionLogin(session);
            }
        };
        checkSession();

        // Also listen for auth changes (e.g., user returns from email verification link)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                handleSessionLogin(session);
            }
        });
        return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSessionLogin = (session) => {
        const name = session.user.user_metadata?.display_name || session.user.email;
        setUsername(name);
        sessionStorage.setItem('username', name);
        setIsLoggedIn(true);

        const cachedRuns = sessionStorage.getItem('pastRuns');
        if (cachedRuns) {
            setPastRuns(JSON.parse(cachedRuns));
            silentFetchPastRuns(name);
        } else {
            fetchPastRuns(name);
        }
    };

    // ── Auto-retry when backend has an error ──────────────────────────────────
    useEffect(() => {
        let interval;
        if (error && isLoggedIn) {
            interval = setInterval(() => { silentFetchPastRuns(username); }, 3000);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [error, isLoggedIn, username]);

    // ── Supabase Auth Handlers ────────────────────────────────────────────────
    const handleSignUp = async (e) => {
        e.preventDefault();
        if (!displayName.trim()) { setAuthError('Please enter a username.'); return; }
        const strength = getPasswordStrength(password);
        if (strength.score < 2) { setAuthError('Password is too weak. Add numbers, symbols, or more characters.'); return; }

        setAuthLoading(true);
        setAuthError(null);
        const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { display_name: displayName.trim() }
            }
        });

        if (signUpError) {
            setAuthError(signUpError.message);
        } else {
            setAuthMode('verify');
        }
        setAuthLoading(false);
    };

    const handleSignIn = async (e) => {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError(null);
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
            setAuthError(signInError.message);
        }
        // On success, onAuthStateChange fires → handleSessionLogin is called automatically
        setAuthLoading(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        sessionStorage.removeItem('username');
        sessionStorage.removeItem('pastRuns');
        setUsername('');
        setIsLoggedIn(false);
        setPastRuns([]);
        setEmail('');
        setPassword('');
        setDisplayName('');
        setAuthMode('login');
    };

    // ── Backend run handlers (100% unchanged from original) ───────────────────
    const silentFetchPastRuns = async (user) => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/api/v1/simulation/runs?username=${encodeURIComponent(user)}`);
            if (response.ok) {
                const data = await response.json();
                setPastRuns(data.runs || []);
                sessionStorage.setItem('pastRuns', JSON.stringify(data.runs || []));
                setError(null);
            } else {
                setError('Could not connect to database. Ensure backend is running.');
            }
        } catch (err) {
            console.warn("Silent fetch failed:", err);
            setError('Could not connect to database. Ensure backend is running.');
        }
    };

    const fetchPastRuns = async (user) => {
        setLoading(true);
        setError(null);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/api/v1/simulation/runs?username=${encodeURIComponent(user)}`);
            if (!response.ok) throw new Error('Failed to fetch simulations');
            const data = await response.json();
            setPastRuns(data.runs || []);
            sessionStorage.setItem('pastRuns', JSON.stringify(data.runs || []));
        } catch (err) {
            setError('Could not connect to database. Ensure backend is running.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleResume = (runId) => {
        const run = pastRuns.find(r => r.run_id === runId);
        if (run && run.config) {
            const params = {
                dateTime:          run.config.target_time,
                weather:           run.config.weather,
                traffic:           run.config.traffic,
                isFestival:        run.config.is_festival,
                fleetDeployment:   run.config.fleet_deployment_pct
            };
            sessionStorage.setItem('simulationParams', JSON.stringify(params));
        }
        sessionStorage.setItem('active_run_id', runId);
        navigate('/admin/zones');
    };

    const handleDelete = async (runId) => {
        setDeletingId(runId);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/api/v1/simulation/${runId}`, { method: 'DELETE' });
            if (response.ok) {
                await silentFetchPastRuns(username);
            }
        } catch (err) {
            console.error("Error deleting simulation:", err);
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    // ────────────────────────────────────────────────────────────────────────
    // RENDER: Auth Screen (not logged in)
    // ────────────────────────────────────────────────────────────────────────
    if (!isLoggedIn) {
        // ── Verification Pending state ──────────────────────────────────────
        if (authMode === 'verify') {
            return (
                <div className="min-h-screen w-full relative overflow-hidden flex flex-col items-center justify-center p-6">
                    <div className="absolute inset-0 cyber-pattern z-0 opacity-80" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/80 z-0 pointer-events-none" />

                    <div className="w-full max-w-md z-10 relative flex flex-col items-center animate-in slide-in-from-bottom-8 duration-700 fade-in">
                        <div className="relative flex flex-col items-center mb-12">
                            <div className="w-40 h-40 relative mb-6">
                                <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
                                <img src={logo} alt="Slot Guard Logo" className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]" />
                            </div>
                            <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-emerald-100 to-emerald-500/50 drop-shadow-sm font-mono">
                                Slot Guard
                            </h1>
                        </div>

                        <div className="w-full border border-emerald-500/20 shadow-2xl shadow-black/80 bg-black/40 backdrop-blur-xl p-8 rounded-2xl text-center space-y-6">
                            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                                <Mail className="w-8 h-8 text-emerald-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white font-mono uppercase tracking-wider mb-2">
                                    Check Your Inbox
                                </h2>
                                <p className="text-sm text-gray-400 font-mono leading-relaxed">
                                    A verification link has been sent to<br />
                                    <span className="text-emerald-400 font-bold">{email}</span>.<br /><br />
                                    Click the link to activate your account and you will be logged in automatically.
                                </p>
                            </div>
                            <button
                                onClick={() => setAuthMode('login')}
                                className="text-xs text-gray-500 hover:text-gray-300 font-mono underline underline-offset-4 transition-colors"
                            >
                                Back to Login
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        // ── Login / Sign Up forms ───────────────────────────────────────────
        return (
            <div className="min-h-screen w-full relative overflow-hidden flex flex-col items-center justify-center p-6">
                <div className="absolute inset-0 cyber-pattern z-0 opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/80 z-0 pointer-events-none" />

                <div className="w-full max-w-md z-10 relative flex flex-col items-center animate-in slide-in-from-bottom-8 duration-700 fade-in">

                    {/* Logo */}
                    <div className="relative flex flex-col items-center mb-10">
                        <div className="w-32 h-32 relative mb-4">
                            <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
                            <img src={logo} alt="Slot Guard Logo" className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]" />
                        </div>
                        <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-emerald-100 to-emerald-500/50 drop-shadow-sm font-mono">
                            Slot Guard
                        </h1>
                        <Badge variant="outline" className="mt-3 text-emerald-400 border-emerald-500/30 bg-emerald-500/10 tracking-widest uppercase font-bold py-1 px-3">
                            Secure Gateway
                        </Badge>
                    </div>

                    {/* Tab toggle */}
                    <div className="flex w-full mb-6 bg-black/40 border border-white/10 rounded-xl p-1">
                        <button
                            onClick={() => { setAuthMode('login'); setAuthError(null); setEmail(''); setPassword(''); setDisplayName(''); }}
                            className={`flex-1 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-widest transition-all ${authMode === 'login' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => { setAuthMode('signup'); setAuthError(null); setEmail(''); setPassword(''); setDisplayName(''); }}
                            className={`flex-1 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-widest transition-all ${authMode === 'signup' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Create Account
                        </button>
                    </div>

                    {/* Form Card */}
                    <form
                        onSubmit={authMode === 'login' ? handleSignIn : handleSignUp}
                        className="w-full border border-white/10 shadow-2xl shadow-black/80 bg-black/40 backdrop-blur-xl p-8 rounded-2xl space-y-5"
                    >
                        {/* Username field — sign up only */}
                        {authMode === 'signup' && (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
                                    <User className="w-4 h-4 text-emerald-500" /> Username
                                </label>
                                <Input
                                    type="text"
                                    placeholder="e.g. Admin"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="h-12 bg-black/50 border-white/10 text-gray-200 rounded-xl font-mono focus-visible:ring-emerald-500 shadow-inner"
                                    required
                                />
                            </div>
                        )}

                        {/* Email */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
                                <Mail className="w-4 h-4 text-emerald-500" /> Email
                            </label>
                            <Input
                                type="email"
                                placeholder="operator@slotguard.io"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="h-12 bg-black/50 border-white/10 text-gray-200 rounded-xl font-mono focus-visible:ring-emerald-500 shadow-inner"
                                required
                                autoFocus
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
                                <Lock className="w-4 h-4 text-emerald-500" /> Password
                            </label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="h-12 bg-black/50 border-white/10 text-gray-200 rounded-xl font-mono focus-visible:ring-emerald-500 shadow-inner pr-12"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(p => !p)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {/* Strength bar only on sign-up */}
                            {authMode === 'signup' && <PasswordStrengthBar password={password} />}
                        </div>

                        {/* Error */}
                        {authError && (
                            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 px-4 py-3 rounded-xl">
                                <Shield className="w-4 h-4 text-red-400 shrink-0" />
                                <p className="text-xs font-mono text-red-300">{authError}</p>
                            </div>
                        )}

                        {/* Submit */}
                        <Button
                            type="submit"
                            disabled={authLoading}
                            className="w-full h-14 text-sm font-mono tracking-[0.2em] uppercase transition-all bg-transparent hover:bg-emerald-950/40 text-emerald-400 rounded-lg border border-emerald-500/30 hover:border-emerald-400 backdrop-blur-sm disabled:opacity-50"
                        >
                            {authLoading
                                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                : null}
                            {authMode === 'login' ? '>_ Authenticate' : '>_ Create Account'}
                            {!authLoading && <ArrowRight className="w-4 h-4 ml-3" />}
                        </Button>
                    </form>
                </div>
            </div>
        );
    }

    // ────────────────────────────────────────────────────────────────────────
    // RENDER: Dashboard (logged in) — 100% original, unchanged
    // ────────────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen w-full relative overflow-hidden flex flex-col p-6 lg:p-12">
            <div className="absolute inset-0 cyber-pattern z-0 opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/80 z-0 pointer-events-none" />

            <div className="max-w-5xl mx-auto w-full z-10 space-y-8 animate-in fade-in duration-500">

                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-white/10 pb-6">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-black/40 border border-white/10 rounded-xl flex items-center justify-center shadow-lg backdrop-blur-sm">
                            <img src={logo} alt="Logo" className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-widest font-mono uppercase drop-shadow-md">Command Hub</h1>
                            <p className="text-sm text-gray-400 font-mono mt-1">
                                Welcome back, <span className="text-emerald-400 font-bold">{username}</span>. Select an operation.
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={handleLogout} className="border-white/10 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl h-11 px-5 font-mono text-xs uppercase tracking-wider bg-black/40 backdrop-blur-sm">
                        <LogOut className="w-4 h-4 mr-2 text-red-400" /> Disconnect
                    </Button>
                </div>

                {error && (
                    <div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded flex items-center gap-3">
                        <Shield className="w-5 h-5 text-red-500" />
                        <span className="text-red-200 font-mono text-sm font-bold">{error}</span>
                    </div>
                )}

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left: New Simulation */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="border border-white/10 shadow-2xl bg-black/40 backdrop-blur-xl rounded-2xl overflow-hidden p-6 text-center flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                                <Rocket className="w-8 h-8 text-emerald-400" />
                            </div>
                            <h2 className="text-lg font-bold text-white font-mono uppercase tracking-wider mb-2">New Simulation</h2>
                            <p className="text-xs text-gray-500 font-mono mb-8">Deploy a new AI-driven prediction instance.</p>
                            <Button
                                onClick={() => navigate('/setup')}
                                className="w-full h-14 text-xs font-mono tracking-[0.2em] uppercase transition-all bg-transparent hover:bg-emerald-950/40 text-emerald-400 rounded-lg border border-emerald-500/30 hover:border-emerald-400 backdrop-blur-sm"
                            >
                                {'>'}_  Initialize <Plus className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>

                    {/* Right: Past Runs */}
                    <div className="lg:col-span-2 border border-white/10 shadow-2xl bg-black/40 backdrop-blur-xl rounded-2xl overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-white/10 bg-white/[0.02]">
                            <h2 className="text-lg font-bold text-gray-200 font-mono uppercase tracking-wider flex items-center gap-3">
                                <Clock className="w-5 h-5 text-emerald-400" /> Operation History
                            </h2>
                        </div>

                        <div className="p-6 flex-grow flex flex-col">
                            {loading ? (
                                <div className="flex-grow flex flex-col items-center justify-center py-12">
                                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                                    <p className="text-xs font-mono text-emerald-500/70 uppercase tracking-widest animate-pulse">Syncing Database...</p>
                                </div>
                            ) : pastRuns.length === 0 ? (
                                <div className="flex-grow flex flex-col items-center justify-center py-16 border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
                                    <Terminal className="w-10 h-10 text-gray-600 mb-4" />
                                    <p className="text-gray-400 font-mono text-sm">No historical operations found.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {pastRuns.map((run) => (
                                        <div key={run.run_id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-emerald-500/30 transition-all">
                                            <div className="mb-4 sm:mb-0">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="font-bold text-gray-200 text-md font-mono">{run.run_name}</h3>
                                                    {run.status === 'ACTIVE' && (
                                                        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                                                            <CheckCircle2 className="w-3 h-3" /> Active
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 font-mono">
                                                    ID: <span className="text-gray-400">{run.run_id.split('-')[0]}</span>
                                                    <span className="mx-2">|</span>
                                                    Date: <span className="text-gray-400">{formatDate(run.created_at)}</span>
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    onClick={() => handleDelete(run.run_id)}
                                                    disabled={deletingId === run.run_id}
                                                    variant="outline"
                                                    className="border-white/10 bg-black/50 text-gray-500 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/10 rounded-lg h-10 w-10 p-0 transition-all group-hover:shadow-[0_0_15px_rgba(239,68,68,0.1)] disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Delete Simulation"
                                                >
                                                    {deletingId === run.run_id
                                                        ? <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                                                        : <Trash2 className="w-4 h-4" />}
                                                </Button>
                                                <Button
                                                    onClick={() => handleResume(run.run_id)}
                                                    variant="outline"
                                                    className="border-white/10 bg-black/50 text-gray-300 hover:text-emerald-400 hover:border-emerald-500/50 rounded-lg h-10 px-5 font-mono text-xs uppercase tracking-widest transition-all group-hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                                                >
                                                    Resume <ArrowRight className="w-4 h-4 ml-2" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
