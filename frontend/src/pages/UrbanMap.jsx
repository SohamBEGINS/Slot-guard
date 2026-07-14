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
        } else if (ratio > 0.8) {
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

            // Refetch to see the new capacity impacts — this also writes fresh data to cachedForecast
            await fetchForecast();

            // Invalidate the ZoneIntelligence param-cache so it is forced to re-run
            // the full /demand-forecast (with new rider counts) instead of serving
            // stale headroom / capacity data from before the rebalance.
            sessionStorage.removeItem('cachedParams');

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

                {/* LEFT: SVG CITY MAP */}
                <div className="lg:col-span-2 flex flex-col">
                    <div className="flex-1 rounded-3xl border border-border/30 overflow-hidden relative" style={{background: '#0d1520', minHeight: '420px'}}>

                        {/* Map legend strip */}
                        <div className="absolute top-3 left-4 z-10 flex items-center gap-3">
                            {[['SAFE','#22c55e'],['WARNING','#eab308'],['CRITICAL','#ef4444']].map(([label, color]) => (
                                <div key={label} className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-sm" style={{background: color, opacity: 0.8}} />
                                    <span className="text-[10px] font-bold tracking-widest uppercase" style={{color: color, opacity: 0.7}}>{label}</span>
                                </div>
                            ))}
                        </div>

                        <svg
                            viewBox="0 0 700 400"
                            className="w-full h-full"
                            style={{display:'block', background: '#0d1520'}}
                        >
                            <defs>
                                {/* Subtle map grid texture */}
                                <pattern id="mapGrid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a2638" strokeWidth="0.5"/>
                                </pattern>
                                {/* Glow filter for selected zone */}
                                <filter id="zoneGlow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="4" result="blur"/>
                                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                                </filter>
                            </defs>

                            {/* Map background grid */}
                            <rect width="700" height="400" fill="url(#mapGrid)"/>

                            {/* Road network — 8px wide for authentic map feel */}
                            {/* Horizontal arterials */}
                            <line x1="0" y1="162" x2="700" y2="162" stroke="#162030" strokeWidth="10"/>
                            <line x1="0" y1="322" x2="700" y2="322" stroke="#162030" strokeWidth="10"/>
                            {/* Vertical roads in Row 1 */}
                            <line x1="134" y1="0"   x2="134" y2="162" stroke="#162030" strokeWidth="10"/>
                            <line x1="444" y1="0"   x2="444" y2="162" stroke="#162030" strokeWidth="10"/>
                            {/* Vertical roads in Row 2 */}
                            <line x1="176" y1="162" x2="176" y2="322" stroke="#162030" strokeWidth="10"/>
                            <line x1="384" y1="162" x2="384" y2="322" stroke="#162030" strokeWidth="10"/>
                            {/* Vertical road in Row 3 */}
                            <line x1="364" y1="322" x2="364" y2="420" stroke="#162030" strokeWidth="10"/>

                            {/* Road centre-line dashes */}
                            <line x1="0" y1="162" x2="700" y2="162" stroke="#1e3048" strokeWidth="1" strokeDasharray="14 10"/>
                            <line x1="0" y1="322" x2="700" y2="322" stroke="#1e3048" strokeWidth="1" strokeDasharray="14 10"/>
                            <line x1="134" y1="0"   x2="134" y2="162" stroke="#1e3048" strokeWidth="1" strokeDasharray="14 10"/>
                            <line x1="444" y1="0"   x2="444" y2="162" stroke="#1e3048" strokeWidth="1" strokeDasharray="14 10"/>
                            <line x1="176" y1="162" x2="176" y2="322" stroke="#1e3048" strokeWidth="1" strokeDasharray="14 10"/>
                            <line x1="384" y1="162" x2="384" y2="322" stroke="#1e3048" strokeWidth="1" strokeDasharray="14 10"/>
                            <line x1="364" y1="322" x2="364" y2="420" stroke="#1e3048" strokeWidth="1" strokeDasharray="14 10"/>

                            {/* Road labels */}
                            <text x="67" y="158" fill="#1e3a52" fontSize="7" textAnchor="middle" fontFamily="sans-serif" letterSpacing="1">NH-4</text>
                            <text x="310" y="158" fill="#1e3a52" fontSize="7" textAnchor="middle" fontFamily="sans-serif" letterSpacing="1">RING ROAD</text>
                            <text x="580" y="158" fill="#1e3a52" fontSize="7" textAnchor="middle" fontFamily="sans-serif" letterSpacing="1">SH-7</text>
                            <text x="280" y="318" fill="#1e3a52" fontSize="7" textAnchor="middle" fontFamily="sans-serif" letterSpacing="1">OUTER RING</text>
                            <text x="545" y="318" fill="#1e3a52" fontSize="7" textAnchor="middle" fontFamily="sans-serif" letterSpacing="1">MG ROAD</text>

                            {/* ── ZONE LAYOUT (visually balanced city-district design) ──
                                Sizes suggest capacity rank — Zone 6 largest (55), Zone 1
                                smallest corner (25) — but shaped for visual harmony, not maths.
                                Row 1 (h=157): zones 1(small), 2(large), 3(medium)
                                Row 2 (h=155): zones 4(small), 5(medium), 6(large)
                                Row 3 (h=93):  zones 7(wider), 8(slightly narrower)
                            */}
                            {(() => {
                                const ZONE_RECTS = {
                                    1: { x: 0,   y: 0,   w: 129, h: 157 },
                                    2: { x: 139, y: 0,   w: 300, h: 157 },
                                    3: { x: 449, y: 0,   w: 251, h: 157 },
                                    4: { x: 0,   y: 167, w: 171, h: 150 },
                                    5: { x: 181, y: 167, w: 198, h: 150 },
                                    6: { x: 389, y: 167, w: 311, h: 150 },
                                    7: { x: 0,   y: 327, w: 359, h: 93  },
                                    8: { x: 369, y: 327, w: 331, h: 93  },
                                };
                                const STATUS_SVG = {
                                    SAFE:     { fill: '#22c55e', stroke: '#22c55e', text: '#86efac', dimText: '#166534' },
                                    WARNING:  { fill: '#eab308', stroke: '#eab308', text: '#fde047', dimText: '#713f12' },
                                    CRITICAL: { fill: '#ef4444', stroke: '#ef4444', text: '#fca5a5', dimText: '#7f1d1d' },
                                };

                                return forecastData.map(zone => {
                                    const rect   = ZONE_RECTS[zone.zone_id];
                                    const metrics = getZoneMetrics(zone);
                                    const isSelected = selectedZone?.zone_id === zone.zone_id;
                                    const isSafe = metrics.status === 'SAFE';
                                    const C = STATUS_SVG[metrics.status] || STATUS_SVG.SAFE;
                                    const cx = rect.x + rect.w / 2;
                                    const cy = rect.y + rect.h / 2;

                                    return (
                                        <g
                                            key={zone.zone_id}
                                            onClick={() => handleZoneSelect(zone)}
                                            style={{ cursor: isSafe ? 'not-allowed' : 'pointer' }}
                                            filter={isSelected ? 'url(#zoneGlow)' : undefined}
                                        >
                                            {/* Zone background fill */}
                                            <rect
                                                x={rect.x + 1} y={rect.y + 1}
                                                width={rect.w - 2} height={rect.h - 2}
                                                rx="4"
                                                fill={C.fill}
                                                fillOpacity={isSelected ? 0.22 : isSafe ? 0.07 : 0.13}
                                                stroke={C.stroke}
                                                strokeWidth={isSelected ? 2.5 : 1.2}
                                                strokeOpacity={isSelected ? 1 : isSafe ? 0.3 : 0.55}
                                            />

                                            {/* Selected pulsing outer ring */}
                                            {isSelected && (
                                                <rect
                                                    x={rect.x + 1} y={rect.y + 1}
                                                    width={rect.w - 2} height={rect.h - 2}
                                                    rx="4"
                                                    fill="none"
                                                    stroke={C.stroke}
                                                    strokeWidth="5"
                                                    strokeOpacity="0.25"
                                                />
                                            )}

                                            {/* Zone number badge (top-left) */}
                                            <text
                                                x={rect.x + 10} y={rect.y + 18}
                                                fill={C.text} fontSize="11"
                                                fontWeight="800" fontFamily="monospace"
                                                fillOpacity={isSafe ? 0.4 : 0.9}
                                            >#{zone.zone_id}</text>

                                            {/* Zone name (center) */}
                                            <text
                                                x={cx} y={cy - (rect.h > 100 ? 10 : 4)}
                                                fill="white" fontSize={rect.w > 200 ? 14 : 12}
                                                fontWeight="700" textAnchor="middle"
                                                fontFamily="sans-serif"
                                                fillOpacity={isSafe ? 0.35 : 0.85}
                                            >{zone.zone_name}</text>

                                            {/* Status label (center, below name) */}
                                            {rect.h > 80 && (
                                                <text
                                                    x={cx} y={cy + (rect.h > 100 ? 8 : 10)}
                                                    fill={C.text} fontSize="9"
                                                    fontWeight="700" textAnchor="middle"
                                                    fontFamily="sans-serif" letterSpacing="2"
                                                    fillOpacity={isSafe ? 0.3 : 0.75}
                                                >{metrics.status}</text>
                                            )}

                                            {/* SAFE lock icon hint */}
                                            {isSafe && (
                                                <text x={cx} y={cy + 22}
                                                    fill={C.text} fontSize="8"
                                                    textAnchor="middle" fontFamily="sans-serif"
                                                    fillOpacity="0.3">NO ACTION NEEDED</text>
                                            )}
                                        </g>
                                    );
                                });
                            })()}

                            {/* Compass rose */}
                            <g transform="translate(672, 32)">
                                <circle cx="0" cy="0" r="18" fill="#0d1520" stroke="#1e3048" strokeWidth="1.5"/>
                                <polygon points="0,-12 3,-4 -3,-4" fill="#ef4444"/>
                                <polygon points="0,12  3,4  -3,4"  fill="#334155"/>
                                <text x="0" y="-14" fill="#94a3b8" fontSize="8" textAnchor="middle" fontFamily="sans-serif" fontWeight="700">N</text>
                            </g>

                            {/* Scale bar */}
                            <g transform="translate(14, 388)">
                                <rect x="0" y="-4" width="50" height="4" fill="#1e3048" rx="1"/>
                                <rect x="0" y="-4" width="25" height="4" fill="#334155" rx="1"/>
                                <text x="0"  y="-7" fill="#475569" fontSize="7" fontFamily="sans-serif">0</text>
                                <text x="45" y="-7" fill="#475569" fontSize="7" fontFamily="sans-serif">2km</text>
                            </g>

                            {/* Click-hint text (only when nothing selected) */}
                            {!selectedZone && (
                                <text x="350" y="396" fill="#334155" fontSize="9"
                                    textAnchor="middle" fontFamily="sans-serif" letterSpacing="1">
                                    TAP A CONGESTED ZONE TO MANAGE FLEET
                                </text>
                            )}
                        </svg>
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
                                        <div className="flex-1 flex flex-col justify-center gap-6">
                                            {/* AI Command Panel */}
                                            <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-6 overflow-hidden">
                                                {/* Subtle grid background */}
                                                <div className="absolute inset-0 opacity-5" style={{backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 20px, currentColor 20px, currentColor 21px), repeating-linear-gradient(90deg, transparent, transparent 20px, currentColor 20px, currentColor 21px)'}} />

                                                {/* Icon + title */}
                                                <div className="relative flex flex-col items-center text-center gap-4">
                                                    <div className="relative">
                                                        <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
                                                        <div className="relative w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                                                            <Zap className="w-8 h-8 text-primary" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-base font-black text-white tracking-wide">System Roster Engine</p>
                                                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-[200px] mx-auto">
                                                            Analyses safe zones, skill tiers &amp; capacity padding to draft an optimal redeployment roster.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Zone stat strip */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="rounded-xl bg-black/30 border border-border/20 p-3 text-center">
                                                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Current Riders</p>
                                                    <p className="text-2xl font-black text-white">{selectedZone.active_riders}</p>
                                                </div>
                                                <div className="rounded-xl bg-black/30 border border-border/20 p-3 text-center">
                                                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Peak Demand</p>
                                                    <p className="text-2xl font-black text-red-400">
                                                        {Math.max(...selectedZone.hours.map(h => h.predicted_demand))}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* CTA Button */}
                                            <Button
                                                onClick={() => {
                                                    const extraCap = parseInt(sessionStorage.getItem('current_extra_cap') || '0');
                                                    fetchDraftRoster(selectedZone, extraCap);
                                                }}
                                                disabled={isFetchingRoster}
                                                className="w-full h-14 text-base font-black tracking-widest uppercase rounded-xl bg-primary hover:bg-primary/90 shadow-[0_0_25px_rgba(var(--primary-rgb,239,68,68),0.35)] transition-all hover:scale-[1.02] hover:shadow-[0_0_35px_rgba(var(--primary-rgb,239,68,68),0.5)] disabled:opacity-60 disabled:scale-100"
                                            >
                                                {isFetchingRoster
                                                    ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Analysing Zones...</>
                                                    : <><Zap className="w-5 h-5 mr-2" /> Get System Recommendation</>
                                                }
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
