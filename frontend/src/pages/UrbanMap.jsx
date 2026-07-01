import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, Navigation, AlertOctagon, ShieldCheck, Zap, Users, ArrowRightLeft } from "lucide-react";

export default function UrbanMap() {
    const navigate = useNavigate();
    const simulationParams = JSON.parse(sessionStorage.getItem('simulationParams') || '{}');

    const [forecastData, setForecastData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [rebalancing, setRebalancing] = useState(false);
    const [notification, setNotification] = useState(null);

    const [selectedZone, setSelectedZone] = useState(null);
    const [draftRoster, setDraftRoster] = useState(null); // null means not fetched yet
    const [isFetchingRoster, setIsFetchingRoster] = useState(false);
    const [checkedRiderIds, setCheckedRiderIds] = useState(new Set());
    const [ridersNeeded, setRidersNeeded] = useState(0);

    const fetchForecast = async () => {
        try {
            const simulationParams = JSON.parse(sessionStorage.getItem('simulationParams') || '{}');
            const queryParams = new URLSearchParams({
                run_id: sessionStorage.getItem('active_run_id'),
                target_time: simulationParams.dateTime || '',
                weather: simulationParams.weather || 'CLEAR',
                traffic: simulationParams.traffic || 'MEDIUM',
                is_festival: simulationParams.isFestival || false
            });
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const res = await fetch(`${API_BASE_URL}/api/v1/simulation/demand-forecast?${queryParams}`);
            const data = await res.json();

            if (!res.ok) {
                console.error("Backend Error:", data);
                throw new Error("Failed to fetch forecast");
            }

            if (data && data.forecast) {
                setForecastData(data.forecast);
                // Update cache so ZoneIntelligence gets the fresh rebalanced data
                sessionStorage.setItem('cachedForecast', JSON.stringify(data.forecast));
            } else {
                setForecastData([]);
            }

        } catch (err) {
            console.error("Failed to fetch forecast:", err);
            setForecastData([]); // Prevent crashing the UI on undefined
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!sessionStorage.getItem('active_run_id')) {
            navigate('/');
            return;
        }
        
        const cachedData = sessionStorage.getItem('cachedForecast');
        if (cachedData) {
            setForecastData(JSON.parse(cachedData));
            setLoading(false);
        } else {
            fetchForecast();
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const getZoneMetrics = (zone) => {
        if (!zone || !zone.hours || zone.hours.length === 0) {
            return { peakDemand: 0, ratio: 0, status: 'SAFE', color: 'bg-green-500/20 border-green-500/50 text-green-400', hoverColor: 'hover:bg-green-500/30', icon: <ShieldCheck className="w-8 h-8 text-green-500" /> };
        }
        const peakDemand = Math.max(...zone.hours.map(h => h.predicted_demand));
        const ratio = peakDemand / zone.capacity;

        let status = 'SAFE';
        let color = 'bg-green-500/20 border-green-500/50 text-green-400';
        let hoverColor = 'hover:bg-green-500/30 hover:border-green-400';
        let icon = <ShieldCheck className="w-8 h-8 text-green-500" />;

        if (ratio >= 1.0) {
            status = 'CRITICAL';
            color = 'bg-red-500/20 border-red-500/50 text-red-400';
            hoverColor = 'hover:bg-red-500/30 hover:border-red-400';
            icon = <AlertOctagon className="w-8 h-8 text-red-500" />;
        } else if (ratio >= 0.8) {
            status = 'WARNING';
            color = 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400';
            hoverColor = 'hover:bg-yellow-500/30 hover:border-yellow-400';
            icon = <Zap className="w-8 h-8 text-yellow-500" />;
        }

        return { peakDemand, ratio, status, color, hoverColor, icon };
    };

    const fetchDraftRoster = async (zone, extraCap) => {
        setIsFetchingRoster(true);
        try {
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            
            // Calculate export quotas: how much capacity can each safe zone spare?
            const safeZoneQuotas = {};
            forecastData.forEach(z => {
                const metrics = getZoneMetrics(z);
                if (metrics.status === 'SAFE') {
                    // Safe line is 80% capacity. So target = ceil(peak / 0.8)
                    const safeTargetCapacity = Math.ceil(metrics.peakDemand / 0.8);
                    const padding = z.capacity - safeTargetCapacity;
                    if (padding > 0) {
                        safeZoneQuotas[z.zone_id] = padding;
                    }
                }
            });
            
            const res = await fetch(`${API_BASE_URL}/api/v1/simulation/draft-roster`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    run_id: sessionStorage.getItem('active_run_id'),
                    target_zone: zone.zone_id,
                    safe_zones: safeZoneQuotas,
                    excess_capacity: extraCap
                })
            });
            const data = await res.json();
            setDraftRoster(data.roster || []);
            setRidersNeeded(data.riders_needed || 0);
            
            // Auto-check recommended, even if it's a partial rebalance
            const recommendedIds = (data.roster || []).filter(r => r.recommended).map(r => r.rider_id);
            setCheckedRiderIds(new Set(recommendedIds));
        } catch (err) {
            console.error(err);
            setDraftRoster([]);
        } finally {
            setIsFetchingRoster(false);
        }
    };

    const handleZoneSelect = (zone) => {
        if (zone.zone_id === selectedZone?.zone_id) return;
        
        const metrics = getZoneMetrics(zone);
        if (metrics.status === 'SAFE') {
            // Can't rebalance into a safe zone
            setSelectedZone(null);
            return;
        }

        setSelectedZone(zone);
        setDraftRoster(null); // Reset roster so they have to click the button
        setCheckedRiderIds(new Set());
        
        // Calculate needed capacity exactly
        const peakDemand = Math.max(...zone.hours.map(h => h.predicted_demand));
        const currentCapacity = zone.capacity;
        
        // Target: If CRITICAL (>= 1.0), goal is WARNING (< 1.0) -> ceil(peak / 1.0)
        // If WARNING (>= 0.8), goal is SAFE (< 0.8) -> ceil(peak / 0.8)
        let targetRatio = 0.8;
        if (metrics.status === 'CRITICAL') {
            // we just need it below 1.0. To be safe we could use 0.99, but peakDemand/1.0 works as a baseline
            // Actually, to make ratio < 1.0, capacity must be > peakDemand.
            targetRatio = 0.99; 
        }
        
        const targetCapacity = Math.ceil(peakDemand / targetRatio);
        const extraCap = Math.max(0, targetCapacity - currentCapacity);
        
        // Store extraCap so the button can use it
        setRidersNeeded(Math.max(1, Math.ceil(extraCap / 2))); // Rough estimate just for initial display
        sessionStorage.setItem('current_extra_cap', extraCap.toString());
    };

    const handleRebalance = async () => {
        if (!selectedZone || checkedRiderIds.size === 0) return;

        setRebalancing(true);
        try {
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const res = await fetch(`${API_BASE_URL}/api/v1/simulation/rebalance-riders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    run_id: sessionStorage.getItem('active_run_id'),
                    target_zone: parseInt(selectedZone.zone_id),
                    rider_ids: Array.from(checkedRiderIds)
                })
            });

            if (!res.ok) throw new Error("Rebalance failed");

            // Refetch to see the new capacity impacts
            await fetchForecast();

            // Set success notification
            setNotification({
                type: 'success',
                message: `Successfully deployed ${checkedRiderIds.size} riders to Zone ${selectedZone.zone_id}. Congestion alleviated!`
            });
            setTimeout(() => setNotification(null), 5000);

            // Reset panel
            setSelectedZone(null);
            setDraftRoster(null);
            setCheckedRiderIds(new Set());

        } catch (err) {
            console.error(err);
            alert("Failed to rebalance riders. Check source capacity.");
        } finally {
            setRebalancing(false);
        }
    };

    if (loading || forecastData.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-screen gap-4 text-primary">
                <Loader2 className="w-12 h-12 animate-spin" />
            </div>
        );
    }
    return (
        <div className="p-8 flex flex-col min-h-[calc(100vh-2rem)]">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-black tracking-tight">Urban Activity Map</h1>
                    <p className="text-muted-foreground mt-2 text-lg font-medium">
                        Live congestion tracking and tactical rider redeployment.
                    </p>
                </div>
            </div>

            {/* TOAST NOTIFICATION */}
            {notification && (
                <div className={`fixed bottom-8 right-8 z-50 flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300 ${
                    notification.type === 'success' 
                        ? 'bg-green-500/20 border-green-500/50 text-green-400' 
                        : 'bg-red-500/20 border-red-500/50 text-red-400'
                }`}>
                    {notification.type === 'success' ? <ShieldCheck className="w-6 h-6" /> : <AlertOctagon className="w-6 h-6" />}
                    <p className="font-bold tracking-wide">{notification.message}</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">

                {/* LEFT: THE CITY GRID */}
                <div className="lg:col-span-2 flex flex-col">
                    <div className="grid grid-cols-4 gap-4 flex-1 bg-card/20 p-6 rounded-3xl border border-border/30">
                        {forecastData.map(zone => {
                            const { peakDemand, status, color, hoverColor, icon } = getZoneMetrics(zone);
                            const isSelected = selectedZone?.zone_id === zone.zone_id;

                            return (
                                <div
                                    key={zone.zone_id}
                                    onClick={() => handleZoneSelect(zone)}
                                    className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 backdrop-blur-sm
                                        ${color} ${hoverColor} ${isSelected ? 'ring-4 ring-primary ring-offset-4 ring-offset-background scale-105 z-10' : ''}
                                    `}
                                >
                                    <div className="absolute top-4 left-4 font-black text-xl opacity-50">#{zone.zone_id}</div>
                                    <div className="mb-4">{icon}</div>
                                    <h3 className="text-xl font-bold mb-1">{zone.zone_name}</h3>
                                    <p className="text-sm font-semibold tracking-wider uppercase opacity-80 mb-4">{status}</p>

                                    <div className="w-full bg-black/40 rounded-xl p-3 flex justify-between items-center text-sm mt-auto">
                                        <div className="flex flex-col items-center">
                                            <span className="text-muted-foreground text-xs uppercase font-bold">Riders</span>
                                            <span className="font-black text-white">{zone.active_riders}</span>
                                        </div>
                                        <div className="w-px h-8 bg-white/20 mx-2"></div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-muted-foreground text-xs uppercase font-bold">Peak</span>
                                            <span className="font-black text-white">{peakDemand}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* RIGHT: REBALANCE COMMAND CENTER */}
                <div className="lg:col-span-1">
                    <Card className="h-full max-h-[calc(100vh-12rem)] border-border/40 shadow-2xl bg-[#1e2329] flex flex-col">
                        <CardHeader className="border-b border-border/10 bg-[#1a1f24] py-6 shrink-0">
                            <CardTitle className="text-xl font-black tracking-wide flex items-center gap-3">
                                <Navigation className="w-6 h-6 text-primary" />
                                Tactical Redeployment
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 flex-1 flex flex-col min-h-0">
                            {!selectedZone ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center">
                                    <ArrowRightLeft className="w-16 h-16 mb-4 opacity-20" />
                                    <p className="text-lg font-medium">Select a zone on the map to manage fleet distribution.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col h-full animate-in fade-in zoom-in duration-300 min-h-0">
                                    <div className="mb-8">
                                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-2">Target Zone</h3>
                                        <div className={`p-4 rounded-xl border-2 flex items-center justify-between ${getZoneMetrics(selectedZone).color}`}>
                                            <span className="text-xl font-black">{selectedZone.zone_name}</span>
                                            <span className="text-sm font-bold bg-black/30 px-3 py-1 rounded-full">
                                                Need Capacity
                                            </span>
                                        </div>
                                    </div>

                                    {draftRoster === null ? (
                                        <div className="flex-1 flex flex-col items-center justify-center">
                                            <Button
                                                onClick={() => {
                                                    const extraCap = parseInt(sessionStorage.getItem('current_extra_cap') || '0');
                                                    fetchDraftRoster(selectedZone, extraCap);
                                                }}
                                                disabled={isFetchingRoster}
                                                className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold h-12 px-6 rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                                            >
                                                {isFetchingRoster ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Zap className="w-5 h-5 mr-2" />}
                                                Get System Recommendation
                                            </Button>
                                        </div>
                                    ) : draftRoster.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center text-muted-foreground p-6 text-center border-2 border-dashed border-border/30 rounded-xl mb-6 bg-black/20">
                                            <div>
                                                <AlertOctagon className="w-10 h-10 mx-auto mb-3 opacity-50" />
                                                <p className="font-medium text-lg">No available riders</p>
                                                <p className="text-sm opacity-70">There are no riders available in SAFE zones to redeploy.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="mb-6 flex justify-between items-end shrink-0">
                                                <div>
                                                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">System Recommendation</h3>
                                                    <p className="text-lg font-black text-primary">Deploy {ridersNeeded} Riders to Zone {selectedZone.zone_id}</p>
                                                </div>
                                                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                                                    {checkedRiderIds.size} Selected
                                                </Badge>
                                            </div>
                                            
                                            {draftRoster.length < ridersNeeded && (
                                                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3 shrink-0">
                                                    <AlertOctagon className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                                                    <div>
                                                        <p className="text-sm font-bold text-amber-500">Partial Rebalancing</p>
                                                        <p className="text-xs text-amber-500/80">Only {draftRoster.length} riders available to deploy safely. (Needs {ridersNeeded} for Zone {selectedZone.zone_id})</p>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex-1 overflow-y-auto pr-2 space-y-3 mb-6 custom-scrollbar">
                                                {draftRoster.map(rider => (
                                                    <div 
                                                        key={rider.rider_id} 
                                                        className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center gap-4 ${
                                                            checkedRiderIds.has(rider.rider_id) 
                                                                ? 'bg-primary/10 border-primary/50' 
                                                                : 'bg-black/20 border-border/20 opacity-70 hover:opacity-100'
                                                        }`}
                                                    onClick={() => {
                                                        const next = new Set(checkedRiderIds);
                                                        if (next.has(rider.rider_id)) next.delete(rider.rider_id);
                                                        else next.add(rider.rider_id);
                                                        setCheckedRiderIds(next);
                                                    }}
                                                >
                                                    <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                                                        checkedRiderIds.has(rider.rider_id) ? 'bg-primary border-primary' : 'border-muted-foreground'
                                                    }`}>
                                                        {checkedRiderIds.has(rider.rider_id) && <svg className="w-3.5 h-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                                    </div>
                                                    
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-sm">{rider.name}</span>
                                                            <Badge variant="outline" className={`text-[10px] h-5 ${
                                                                rider.skill_tier === 'EXPERT' ? 'text-indigo-400 border-indigo-400/30 bg-indigo-400/10' :
                                                                rider.skill_tier === 'STANDARD' ? 'text-blue-400 border-blue-400/30 bg-blue-400/10' :
                                                                'text-gray-400 border-gray-400/30 bg-gray-400/10'
                                                            }`}>
                                                                {rider.skill_tier}
                                                            </Badge>
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">From Zone {rider.source_zone}</span>
                                                    </div>
                                                    
                                                    {rider.recommended && !checkedRiderIds.has(rider.rider_id) && (
                                                        <span className="text-[10px] text-muted-foreground italic">(Recommended)</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        </>
                                    )}

                                    {draftRoster !== null && draftRoster.length > 0 && (
                                        <Button
                                            size="lg"
                                            className="w-full h-14 text-lg font-black tracking-wider uppercase rounded-xl mt-auto shadow-lg shrink-0"
                                            disabled={checkedRiderIds.size === 0 || rebalancing}
                                            onClick={handleRebalance}
                                        >
                                            {rebalancing ? <Loader2 className="w-6 h-6 animate-spin" /> : "Approve & Deploy"}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
}
