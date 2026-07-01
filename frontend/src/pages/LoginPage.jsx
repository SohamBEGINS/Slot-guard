import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowRight, Clock, Plus, LogOut, CheckCircle2, Rocket, Terminal, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// Adjust path if logo is elsewhere
import logo from '../assets/logo_transparent.png';

export default function LoginPage() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [pastRuns, setPastRuns] = useState([]);
    const [loading, setLoading] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState(null);

    // Check if already logged in on mount
    useEffect(() => {
        const storedUser = sessionStorage.getItem('username');
        if (storedUser) {
            setUsername(storedUser);
            setIsLoggedIn(true);
            
            const cachedRuns = sessionStorage.getItem('pastRuns');
            if (cachedRuns) {
                setPastRuns(JSON.parse(cachedRuns));
                // Fetch silently in the background to update cache without showing a spinner
                silentFetchPastRuns(storedUser);
            } else {
                fetchPastRuns(storedUser);
            }
        }
    }, []);

    // Auto-retry polling if backend goes down
    useEffect(() => {
        let interval;
        if (error && isLoggedIn) {
            interval = setInterval(() => {
                silentFetchPastRuns(username);
            }, 3000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [error, isLoggedIn, username]);

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

    const handleLogin = (e) => {
        e.preventDefault();
        if (!username.trim()) return;
        
        sessionStorage.setItem('username', username.trim());
        setIsLoggedIn(true);
        fetchPastRuns(username.trim());
    };

    const handleLogout = () => {
        sessionStorage.removeItem('username');
        sessionStorage.removeItem('pastRuns');
        setUsername('');
        setIsLoggedIn(false);
        setPastRuns([]);
    };

    const handleResume = (runId) => {
        // Reconstruct simulationParams from the stored config
        const run = pastRuns.find(r => r.run_id === runId);
        if (run && run.config) {
            const params = {
                dateTime: run.config.target_time,
                weather: run.config.weather,
                traffic: run.config.traffic,
                isFestival: run.config.is_festival,
                fleetDeployment: run.config.fleet_deployment_pct
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
            const response = await fetch(`${apiUrl}/api/v1/simulation/${runId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                // Silently refresh the list
                await silentFetchPastRuns(username);
            } else {
                console.error("Failed to delete simulation");
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

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen w-full relative overflow-hidden flex flex-col items-center justify-center p-6">
                {/* CYBER BACKGROUND */}
                <div className="absolute inset-0 cyber-pattern z-0 opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/80 z-0 pointer-events-none" />

                <div className="w-full max-w-md z-10 relative flex flex-col items-center animate-in slide-in-from-bottom-8 duration-700 fade-in">
                    
                    {/* Logo Area */}
                    <div className="relative flex flex-col items-center mb-12">
                        <div className="w-40 h-40 relative mb-6">
                            <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
                            <img src={logo} alt="Slot Guard Logo" className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]" />
                        </div>
                        <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-emerald-100 to-emerald-500/50 drop-shadow-sm font-mono">
                            Slot Guard
                        </h1>
                        <Badge variant="outline" className="mt-4 text-emerald-400 border-emerald-500/30 bg-emerald-500/10 tracking-widest uppercase font-bold py-1 px-3">
                            Secure Gateway
                        </Badge>
                    </div>

                    {/* Form Card */}
                    <form onSubmit={handleLogin} className="w-full border border-white/10 shadow-2xl shadow-black/80 bg-black/40 backdrop-blur-xl p-8 rounded-2xl space-y-6">
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
                                <Terminal className="w-4 h-4 text-emerald-500" />
                                Operator ID
                            </label>
                            <Input 
                                type="text"
                                placeholder="Enter credentials..."
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="h-12 bg-black/50 border-white/10 text-gray-200 text-lg rounded-xl font-mono focus-visible:ring-emerald-500 shadow-inner"
                                autoFocus
                            />
                        </div>
                        <Button 
                            type="submit" 
                            className="w-full h-14 text-sm font-mono tracking-[0.2em] uppercase transition-all bg-transparent hover:bg-emerald-950/40 text-emerald-400 rounded-lg border border-emerald-500/30 hover:border-emerald-400 backdrop-blur-sm"
                            disabled={!username.trim()}
                        >
                            &gt;_ Authenticate <ArrowRight className="w-4 h-4 ml-3" />
                        </Button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full relative overflow-hidden flex flex-col p-6 lg:p-12">
            {/* CYBER BACKGROUND */}
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

                {/* Main Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left Col: Actions */}
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
                                &gt;_ Initialize <Plus className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>

                    {/* Right Col: Past Runs */}
                    <div className="lg:col-span-2 border border-white/10 shadow-2xl bg-black/40 backdrop-blur-xl rounded-2xl overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-white/10 bg-white/[0.02]">
                            <h2 className="text-lg font-bold text-gray-200 font-mono uppercase tracking-wider flex items-center gap-3">
                                <Clock className="w-5 h-5 text-emerald-400" /> Operation History
                            </h2>
                        </div>
                        
                        <div className="p-6 flex-grow flex flex-col">
                            {loading ? (
                                <div className="flex-grow flex flex-col items-center justify-center py-12">
                                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
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
                                                    ID: <span className="text-gray-400">{run.run_id.split('-')[0]}</span> <span className="mx-2">|</span> Date: <span className="text-gray-400">{formatDate(run.created_at)}</span>
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
                                                    {deletingId === run.run_id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4" />
                                                    )}
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
