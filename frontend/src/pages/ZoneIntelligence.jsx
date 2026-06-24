import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Loader2, AlertTriangle, ShieldCheck, Lock, Users, Package, TrendingUp } from "lucide-react";

export default function ZoneIntelligence() {
    const navigate = useNavigate();

    const simulationParams = JSON.parse(sessionStorage.getItem('simulationParams') || '{}');

    const [forecastData, setForecastData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeZoneId, setActiveZoneId] = useState("1"); 
    const [overrides, setOverrides] = useState({}); // { "zoneId-slot": isOpen (boolean) }

    useEffect(() => {
        if (!simulationParams.dateTime) {
            navigate('/');
            return;
        }

        const fetchForecast = async () => {
            const cachedParams = sessionStorage.getItem('cachedParams');
            const cachedData = sessionStorage.getItem('cachedForecast');
            
            const currentParamsStr = JSON.stringify(simulationParams);

            if (cachedParams === currentParamsStr && cachedData) {
                setForecastData(JSON.parse(cachedData));
                setLoading(false);
                return;
            }

            try {
                const queryParams = new URLSearchParams({
                    target_time: simulationParams.dateTime,
                    weather: simulationParams.weather,
                    traffic: simulationParams.traffic,
                    is_festival: simulationParams.isFestival
                });
                const res = await fetch(`http://localhost:8000/api/v1/simulation/demand-forecast?${queryParams}`);
                const data = await res.json();
                
                setForecastData(data.forecast);
                
                sessionStorage.setItem('cachedParams', currentParamsStr);
                sessionStorage.setItem('cachedForecast', JSON.stringify(data.forecast));
                
            } catch (err) {
                console.error("Failed to fetch forecast:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchForecast();
    }, []);

    const handleToggleOverride = (zoneId, slot, currentIsOpen) => {
        const key = `${zoneId}-${slot}`;
        setOverrides(prev => ({
            ...prev,
            [key]: !currentIsOpen
        }));
    };

    const getChartStatusColor = (status) => {
        switch (status) {
            case 'LOCKED': return '#ef4444';
            case 'RISK': return '#eab308';
            default: return '#22c55e';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'LOCKED': return <Lock className="w-5 h-5 text-red-500" />;
            case 'RISK': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
            default: return <ShieldCheck className="w-5 h-5 text-green-500" />;
        }
    };


    if (loading || forecastData.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-screen gap-4 text-primary">
                <Loader2 className="w-12 h-12 animate-spin" />
                <h2 className="text-xl font-bold animate-pulse">XGBoost is computing predictions...</h2>
            </div>
        );
    }

    const activeZone = forecastData.find(z => z.zone_id.toString() === activeZoneId) || forecastData[0];
    
    // Find the peak value and which hours it occurs
    const peakDemand = Math.max(...activeZone.hours.map(h => h.predicted_demand));
    const peakHours = activeZone.hours
        .filter(h => h.predicted_demand === peakDemand)
        .map(h => h.slot.split(' ')[0]); // Get just the "18:00" part

    const peakHoursDisplay = peakHours.length > 2 
        ? `${peakHours.slice(0,2).join(', ')}...` 
        : peakHours.join(', ');

    return (
        <div className="p-6 flex flex-col min-h-[calc(100vh-2rem)]">
            {/* HEADER & SCENARIO STRIP */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/40 shrink-0">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Zone Intelligence</h1>
                    <p className="text-muted-foreground mt-1 text-base">
                        Deep-dive capacity and slot management.
                    </p>
                </div>
                <div className="flex gap-3">
                    <Badge variant="outline" className="h-8 px-4 text-sm bg-primary/10 border-primary/20">
                        ☁ {simulationParams.weather}
                    </Badge>
                    <Badge variant="outline" className="h-8 px-4 text-sm bg-primary/10 border-primary/20">
                        🚦 {simulationParams.traffic}
                    </Badge>
                    {simulationParams.isFestival && (
                        <Badge className="h-8 px-4 text-sm bg-indigo-500 hover:bg-indigo-600">
                            🎉 Festival Surge
                        </Badge>
                    )}
                </div>
            </div>

            {/* ZONE SELECTOR & KPI BADGES */}
            <div className="flex items-center gap-6 mb-6 shrink-0">
                <Select value={activeZoneId} onValueChange={setActiveZoneId}>
                    <SelectTrigger className="w-[240px] h-12 bg-primary text-primary-foreground font-bold text-lg border-none focus:ring-0 rounded-full px-6 shadow-md hover:scale-[1.02] transition-transform">
                        <SelectValue placeholder="Select Zone" />
                    </SelectTrigger>
                    <SelectContent>
                        {forecastData.map(z => (
                            <SelectItem key={z.zone_id} value={z.zone_id.toString()} className="text-base py-2">
                                <span className="font-semibold">{z.zone_name}</span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="flex gap-4 flex-1">
                    <div className="flex items-center gap-3 bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl px-6 py-3 shadow-md flex-1">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-0.5">Active Riders</p>
                            <p className="text-2xl font-black leading-none">{activeZone.active_riders}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl px-6 py-3 shadow-md flex-1">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <Package className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-0.5">Base Capacity</p>
                            <p className="text-2xl font-black leading-none">{activeZone.capacity} <span className="text-base font-medium text-muted-foreground">/ hr</span></p>
                        </div>
                    </div>

                    <div className={`flex items-center gap-3 backdrop-blur-md border rounded-2xl px-6 py-3 shadow-md flex-1 ${peakDemand > activeZone.capacity ? 'bg-red-500/10 border-red-500/30' : 'bg-card/60 border-border/50'}`}>
                        <div className={`p-2 rounded-full ${peakDemand > activeZone.capacity ? 'bg-red-500/20' : 'bg-primary/10'}`}>
                            <TrendingUp className={`w-5 h-5 ${peakDemand > activeZone.capacity ? 'text-red-500' : 'text-primary'}`} />
                        </div>
                        <div>
                            <p className={`text-xs uppercase tracking-widest font-semibold mb-0.5 ${peakDemand > activeZone.capacity ? 'text-red-500/80' : 'text-muted-foreground'}`}>Predicted Peak</p>
                            <div className="flex items-baseline gap-2">
                                <p className={`text-2xl font-black leading-none ${peakDemand > activeZone.capacity ? 'text-red-500' : ''}`}>{peakDemand}</p>
                                <span className={`text-xs font-semibold ${peakDemand > activeZone.capacity ? 'text-red-400' : 'text-muted-foreground'}`}>at {peakHoursDisplay}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT GRID */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 min-h-0">
                
                {/* LEFT: CHART */}
                <Card className="xl:col-span-5 border-border/40 shadow-xl bg-card/40 backdrop-blur-md flex flex-col min-h-0">
                    <CardHeader className="pb-2 pt-4">
                        <CardTitle className="text-lg font-bold tracking-wide">{activeZone.zone_name} Demand Trend</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-center min-h-0 pb-2">
                        <div className="h-full w-full min-h-[250px]">
                            <ChartContainer config={{ predicted_demand: { label: "Demand" } }} className="h-full w-full">
                                    <BarChart accessibilityLayer data={activeZone.hours} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                                        <XAxis dataKey="slot" tickLine={false} tickMargin={10} axisLine={false} tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <ChartTooltip content={<ChartTooltipContent />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                                        <ReferenceLine
                                            y={activeZone.capacity}
                                            stroke="#ef4444"
                                            strokeDasharray="5 5"
                                            strokeWidth={1.5}
                                            label={{ position: 'top', value: `Max Capacity: ${activeZone.capacity}`, fill: '#ef4444', fontSize: 12, fontWeight: 'bold' }}
                                        />
                                        <Bar dataKey="predicted_demand" radius={[4, 4, 0, 0]} maxBarSize={60}>
                                            {activeZone.hours.map((entry, index) => {
                                                const key = `${activeZone.zone_id}-${entry.slot}`;
                                                const overrideStatus = overrides[key];
                                                const isForceClosed = overrideStatus === false;
                                                
                                                let fill = getChartStatusColor(entry.status);
                                                if (isForceClosed) fill = '#4b5563'; 
                                                
                                                return <Cell key={`cell-${index}`} fill={fill} />;
                                            })}
                                        </Bar>
                                    </BarChart>
                            </ChartContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* RIGHT: SLOT CONFIG MANAGER */}
                <Card className="xl:col-span-7 border-border/40 shadow-xl bg-[#1e2329] flex flex-col overflow-hidden min-h-0">
                    <CardHeader className="border-b border-border/10 bg-[#1a1f24] py-4 shrink-0">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-xs tracking-widest text-muted-foreground uppercase font-black">Slot Configuration Manager</CardTitle>
                                <p className="text-xs text-primary mt-1 font-semibold">ZONE: {activeZone.zone_name.toUpperCase()}</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase bg-[#1a1f24]/80 border-b border-border/10 sticky top-0 z-10 backdrop-blur-md">
                                <tr>
                                    <th className="px-6 py-3 font-bold tracking-wider">Slot Window</th>
                                    <th className="px-6 py-3 font-bold tracking-wider">Current Load</th>
                                    <th className="px-6 py-3 font-bold tracking-wider">Predicted Demand</th>
                                    <th className="px-6 py-3 font-bold tracking-wider">Status / Alert</th>
                                    <th className="px-6 py-3 font-bold tracking-wider text-center">Action Override</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/10">
                                {activeZone.hours.map((h, i) => {
                                    const key = `${activeZone.zone_id}-${h.slot}`;
                                    // Default isOpen logic
                                    const defaultIsOpen = h.status !== 'LOCKED';
                                    const currentIsOpen = overrides[key] !== undefined ? overrides[key] : defaultIsOpen;
                                    const isManuallyOverridden = overrides[key] !== undefined && overrides[key] !== defaultIsOpen;

                                    const getStatusColorCls = (status) => {
                                        if (status === 'LOCKED') return 'text-red-500';
                                        if (status === 'RISK') return 'text-yellow-500';
                                        return 'text-green-500';
                                    };

                                    const getAlertText = (status) => {
                                        if (status === 'LOCKED') return 'CRITICAL - COLLISION PREDICTED';
                                        if (status === 'RISK') return 'WARNING - HIGH LOAD';
                                        return 'SAFE - OPTIMAL';
                                    };

                                    return (
                                        <tr key={i} className={`hover:bg-white/5 transition-colors ${!currentIsOpen ? 'opacity-60 bg-black/20' : ''}`}>
                                            <td className="px-6 py-4 font-bold text-base whitespace-nowrap">{h.slot}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-muted-foreground font-medium">{h.current_load} Orders</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`font-black text-lg ${h.status === 'LOCKED' ? 'text-red-400' : ''}`}>
                                                    {h.predicted_demand} <span className="text-xs font-medium text-muted-foreground ml-1">Predicted</span>
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {!currentIsOpen && defaultIsOpen ? (
                                                    <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-xs text-gray-400">
                                                        <Lock className="w-4 h-4" />
                                                        FORCE CLOSED BY ADMIN
                                                    </div>
                                                ) : currentIsOpen && !defaultIsOpen ? (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-xs text-yellow-500">
                                                            <AlertTriangle className="w-4 h-4" />
                                                            FORCE OPENED BY ADMIN (RISK!)
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">
                                                            Capacity Exceeded
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-1">
                                                        <div className={`flex items-center gap-1.5 font-bold uppercase tracking-wider text-xs ${getStatusColorCls(h.status)}`}>
                                                            {getStatusIcon(h.status)}
                                                            {getAlertText(h.status)}
                                                        </div>
                                                        <span className="text-xs text-muted-foreground font-medium">
                                                            Riders: {activeZone.active_riders} | Cap: {activeZone.capacity}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-3">
                                                    <span className={`text-xs font-bold uppercase tracking-wider ${currentIsOpen ? 'text-green-500' : 'text-muted-foreground'}`}>
                                                        {currentIsOpen ? 'Open' : 'Force Close'}
                                                    </span>
                                                    <Switch 
                                                        checked={currentIsOpen} 
                                                        onCheckedChange={() => handleToggleOverride(activeZone.zone_id, h.slot, currentIsOpen)}
                                                        className={currentIsOpen ? 'data-[state=checked]:bg-green-500' : 'bg-muted'}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
