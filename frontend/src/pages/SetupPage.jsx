import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Rocket, CloudRain, Calendar, PartyPopper, Car, Users, ShoppingBag, Clock } from "lucide-react";
import TerminalLoader from "../components/TerminalLoader";

// Adjust path if logo is elsewhere
import logo from '../assets/logo_transparent.png';

export default function SetupPage() {
    const navigate = useNavigate();

    // Default datetime: tomorrow at 12:00 PM
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 1);
    defaultDate.setHours(12, 0, 0, 0);
    const localIsoString = new Date(defaultDate.getTime() - (defaultDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

    const [simulationParams, setSimulationParams] = useState({
        dateTime: localIsoString,
        weather: "CLEAR",
        traffic: "LOW",
        isFestival: false,
        fleetSize: 200,
        initialOrders: 200,
    });
    
    const [isLaunching, setIsLaunching] = useState(false);
    const [loadingStep, setLoadingStep] = useState(0);
    const [initError, setInitError] = useState(null);

    const handleLaunch = async () => {
        setIsLaunching(true);
        setInitError(null);
        setLoadingStep(0); // Wiping active simulation states...

        try {
            await new Promise(r => setTimeout(r, 600));

            const payload = {
                target_time: new Date(simulationParams.dateTime).toISOString(),
                weather: simulationParams.weather,
                traffic: simulationParams.traffic,
                is_festival: simulationParams.isFestival,
                fleet_size: simulationParams.fleetSize,
                initial_orders: simulationParams.initialOrders,
            };

            setLoadingStep(1); // Redistributing riders...
            
            const response = await fetch('http://127.0.0.1:8000/api/v1/simulation/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            
            if (!response.ok) throw new Error(`API returned ${response.status}`);

            setLoadingStep(4); // Downloading dependencies...
            await new Promise(r => setTimeout(r, 800));

            setLoadingStep(6); // Activating endpoints...
            
            try {
                sessionStorage.setItem('simulationParams', JSON.stringify(simulationParams));
            } catch (e) {
                console.warn("Could not save to sessionStorage", e);
            }

            navigate('/admin/zones');

        } catch (err) {
            console.error("Initialization Failed:", err);
            setInitError(err.message);
            setIsLaunching(false);
        }
    };

    return (
        <div className="min-h-screen w-full relative overflow-hidden flex">
            {/* CYBER BACKGROUND */}
            <div className="absolute inset-0 cyber-pattern z-0 opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/80 z-0 pointer-events-none" />

            {/* Terminal Loader Overlay */}
            {isLaunching && <TerminalLoader activeIndex={loadingStep} />}

            <div className="w-full flex z-10 relative">
                {/* LEFT COLUMN: Logo & Branding */}
                <div className="hidden lg:flex w-1/2 flex-col items-center justify-center border-r border-white/5 relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-black/50" />
                    
                    <div className="relative flex flex-col items-center animate-in slide-in-from-left duration-700 fade-in">
                        <div className="w-64 h-64 relative mb-8">
                            <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
                            <img src={logo} alt="Slot Guard Logo" className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]" />
                        </div>
                        
                        <div className="text-center space-y-4">
                            <h1 className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-emerald-100 to-emerald-500/50 drop-shadow-sm font-mono">
                                Slot Guard
                            </h1>
                            <div className="flex items-center justify-center gap-3">
                                <div className="h-[1px] w-12 bg-emerald-500/50" />
                                <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 tracking-widest uppercase font-bold py-1 px-3">
                                    v2.0.4-beta
                                </Badge>
                                <div className="h-[1px] w-12 bg-emerald-500/50" />
                            </div>
                            <h2 className="text-sm font-mono tracking-[0.3em] text-gray-400 uppercase mt-4">
                                Predictive Hyperlocal Logistics
                            </h2>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Setup Card */}
                <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative">
                    <div className="w-full max-w-2xl z-10 border border-white/10 shadow-2xl shadow-black/80 bg-black/40 backdrop-blur-xl rounded-2xl overflow-hidden flex flex-col">

                        {/* CARD HEADER */}
                        <div className="p-8 border-b border-white/10 bg-white/[0.02] relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
                                <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] flex-shrink-0">
                                    <Rocket className="w-8 h-8 text-emerald-400" />
                                </div>
                                <div className="pt-1">
                                    <h2 className="text-3xl font-black text-white tracking-widest font-mono uppercase drop-shadow-md">Mission Briefing</h2>
                                    <p className="text-sm text-gray-400 font-mono mt-2 leading-relaxed">Configure scenario parameters before launching the prediction engine.</p>
                                </div>
                            </div>
                        </div>

                        {/* ERROR ALERT UI */}
                        {initError && (
                            <div className="bg-red-500/10 border-l-4 border-red-500 p-4 m-6 rounded flex items-center gap-3">
                                <span className="text-red-500 font-bold">ERROR:</span>
                                <span className="text-red-200 font-mono text-sm">{initError}</span>
                            </div>
                        )}

                        {/* CARD CONTENT - LIST STYLE */}
                        <div className="flex flex-col divide-y divide-white/5">

                            {/* ROW 1: Target Time */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-transparent hover:bg-white/[0.02] transition-colors gap-4 group">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-white/5 rounded-lg border border-white/10 group-hover:border-white/20 transition-colors">
                                        <Calendar className="w-5 h-5 text-gray-300" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-200 tracking-wider">Target Date &amp; Time</h3>
                                        <p className="text-xs text-gray-500 mt-1">Sets the window for demand forecasting.</p>
                                    </div>
                                </div>
                                <div className="w-full sm:w-64">
                                    <Input
                                        type="datetime-local"
                                        value={simulationParams.dateTime}
                                        onChange={(e) => setSimulationParams({ ...simulationParams, dateTime: e.target.value })}
                                        className="bg-black/50 border-white/10 focus-visible:ring-emerald-500 text-gray-200 h-11 px-4 shadow-inner [color-scheme:dark]"
                                    />
                                </div>
                            </div>

                            {/* ROW 2: Active Fleet Size */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-transparent hover:bg-white/[0.02] transition-colors gap-4 group">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-white/5 rounded-lg border border-white/10 group-hover:border-white/20 transition-colors">
                                        <Users className="w-5 h-5 text-gray-300" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-200 tracking-wider">Active Fleet Size</h3>
                                        <p className="text-xs text-gray-500 mt-1">Total active riders deployed city-wide.</p>
                                    </div>
                                </div>
                                <div className="w-full sm:w-64">
                                    <Input
                                        type="number"
                                        min="50" max="1000" step="10"
                                        value={simulationParams.fleetSize}
                                        onChange={(e) => setSimulationParams({ ...simulationParams, fleetSize: parseInt(e.target.value) || 0 })}
                                        className="bg-black/50 border-white/10 focus-visible:ring-primary text-gray-200 h-11 px-4 font-mono text-lg shadow-inner"
                                    />
                                </div>
                            </div>

                            {/* ROW 3: Initial Orders */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-transparent hover:bg-white/[0.02] transition-colors gap-4 group">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-white/5 rounded-lg border border-white/10 group-hover:border-white/20 transition-colors">
                                        <ShoppingBag className="w-5 h-5 text-gray-300" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-200 tracking-wider">Initial City Orders</h3>
                                        <p className="text-xs text-gray-500 mt-1">Base level of orders to inject.</p>
                                    </div>
                                </div>
                                <div className="w-full sm:w-64">
                                    <Input
                                        type="number"
                                        min="50" max="1000" step="10"
                                        value={simulationParams.initialOrders}
                                        onChange={(e) => setSimulationParams({ ...simulationParams, initialOrders: parseInt(e.target.value) || 0 })}
                                        className="bg-black/50 border-white/10 focus-visible:ring-primary text-gray-200 h-11 px-4 font-mono text-lg shadow-inner"
                                    />
                                </div>
                            </div>

                            {/* ROW 4: Weather */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-transparent hover:bg-white/[0.02] transition-colors gap-4 group">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-white/5 rounded-lg border border-white/10 group-hover:border-white/20 transition-colors">
                                        <CloudRain className="w-5 h-5 text-gray-300" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-200 tracking-wider">Weather Condition</h3>
                                        <p className="text-xs text-gray-500 mt-1">Affects delivery speed and capacities.</p>
                                    </div>
                                </div>
                                <div className="w-full sm:w-64">
                                    <Select value={simulationParams.weather} onValueChange={(val) => setSimulationParams({ ...simulationParams, weather: val })}>
                                        <SelectTrigger className="bg-black/50 border-white/10 focus:ring-primary text-gray-200 h-11 px-4 shadow-inner">
                                            <SelectValue placeholder="Select weather..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CLEAR">Clear skies</SelectItem>
                                            <SelectItem value="WINDY">Windy</SelectItem>
                                            <SelectItem value="RAIN">Heavy Rain</SelectItem>
                                            <SelectItem value="STORM">Severe Storm</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* ROW 5: Traffic */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-transparent hover:bg-white/[0.02] transition-colors gap-4 group">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-white/5 rounded-lg border border-white/10 group-hover:border-white/20 transition-colors">
                                        <Car className="w-5 h-5 text-gray-300" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-200 tracking-wider">City Traffic Level</h3>
                                        <p className="text-xs text-gray-500 mt-1">Scales total order demand city-wide.</p>
                                    </div>
                                </div>
                                <div className="w-full sm:w-64">
                                    <Select value={simulationParams.traffic} onValueChange={(val) => setSimulationParams({ ...simulationParams, traffic: val })}>
                                        <SelectTrigger className="bg-black/50 border-white/10 focus:ring-primary text-gray-200 h-11 px-4 shadow-inner">
                                            <SelectValue placeholder="Select traffic..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="LOW">Normal Traffic</SelectItem>
                                            <SelectItem value="MEDIUM">Moderate Congestion</SelectItem>
                                            <SelectItem value="HIGH">Heavy Traffic</SelectItem>
                                            <SelectItem value="GRIDLOCK">Gridlock</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* ROW 6: Festival */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-transparent hover:bg-white/[0.02] transition-colors gap-4 group">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-emerald-500/10 rounded-lg border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)] group-hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all">
                                        <PartyPopper className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-emerald-400 tracking-wider">Active Festival / Holiday</h3>
                                        <p className="text-xs text-emerald-500/70 mt-1">Applies high-demand surge multipliers.</p>
                                    </div>
                                </div>
                                <div className="w-auto flex items-center pr-4">
                                    <Switch
                                        checked={simulationParams.isFestival}
                                        onCheckedChange={(checked) => setSimulationParams({ ...simulationParams, isFestival: checked })}
                                        className="data-[state=checked]:bg-emerald-500 scale-125"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* CARD FOOTER */}
                        <div className="p-8 border-t border-white/10 bg-white/[0.02]">
                            <Button
                                onClick={handleLaunch}
                                disabled={isLaunching}
                                className="w-full h-14 text-sm font-mono tracking-[0.2em] uppercase transition-all bg-black/40 hover:bg-emerald-950/40 text-emerald-400 rounded-lg border border-emerald-500/30 hover:border-emerald-400 backdrop-blur-sm"
                            >
                                {isLaunching ? 'SYSTEM.INITIALIZING...' : '>_ INITIALIZE_SIMULATION'}
                                <Rocket className={`w-4 h-4 ml-3 ${isLaunching ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
