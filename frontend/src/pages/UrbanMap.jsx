import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, Navigation, AlertOctagon, ShieldCheck, Zap, Users, ArrowRightLeft } from "lucide-react";

export default function UrbanMap() {
    const simulationParams = JSON.parse(sessionStorage.getItem('simulationParams') || '{}');
    
    const [forecastData, setForecastData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [rebalancing, setRebalancing] = useState(false);
    
    const [selectedZone, setSelectedZone] = useState(null);
    const [sourceZoneId, setSourceZoneId] = useState("");
    const [transferAmount, setTransferAmount] = useState([5]);

    const fetchForecast = async () => {
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
            
            // Update cache so ZoneIntelligence gets the fresh rebalanced data
            sessionStorage.setItem('cachedForecast', JSON.stringify(data.forecast));
            
        } catch (err) {
            console.error("Failed to fetch forecast:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Load initially from cache to be fast, but we can also fetch fresh if needed
        const cachedData = sessionStorage.getItem('cachedForecast');
        if (cachedData) {
            setForecastData(JSON.parse(cachedData));
            setLoading(false);
        } else {
            fetchForecast();
        }
    }, []);

    const handleRebalance = async () => {
        if (!selectedZone || !sourceZoneId) return;
        
        setRebalancing(true);
        try {
            const res = await fetch(`http://localhost:8000/api/v1/simulation/rebalance-riders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source_zone: parseInt(sourceZoneId),
                    target_zone: parseInt(selectedZone.zone_id),
                    rider_count: transferAmount[0]
                })
            });
            
            if (!res.ok) throw new Error("Rebalance failed");
            
            // Refetch to see the new capacity impacts
            await fetchForecast();
            
            // Reset panel
            setSourceZoneId("");
            setTransferAmount([5]);
            
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

    const getZoneMetrics = (zone) => {
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
                                    onClick={() => setSelectedZone(zone)}
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
                    <Card className="h-full border-border/40 shadow-2xl bg-[#1e2329] flex flex-col">
                        <CardHeader className="border-b border-border/10 bg-[#1a1f24] py-6">
                            <CardTitle className="text-xl font-black tracking-wide flex items-center gap-3">
                                <Navigation className="w-6 h-6 text-primary" />
                                Tactical Redeployment
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 flex-1 flex flex-col">
                            {!selectedZone ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center">
                                    <ArrowRightLeft className="w-16 h-16 mb-4 opacity-20" />
                                    <p className="text-lg font-medium">Select a zone on the map to manage fleet distribution.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col h-full animate-in fade-in zoom-in duration-300">
                                    <div className="mb-8">
                                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-2">Target Zone</h3>
                                        <div className={`p-4 rounded-xl border-2 flex items-center justify-between ${getZoneMetrics(selectedZone).color}`}>
                                            <span className="text-xl font-black">{selectedZone.zone_name}</span>
                                            <span className="text-sm font-bold bg-black/30 px-3 py-1 rounded-full">
                                                Need Capacity
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mb-8">
                                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Pull Riders From</h3>
                                        <Select value={sourceZoneId} onValueChange={setSourceZoneId}>
                                            <SelectTrigger className="h-14 bg-black/40 border-border/50 text-lg">
                                                <SelectValue placeholder="Select Safe Zone" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {forecastData
                                                    .filter(z => z.zone_id !== selectedZone.zone_id && getZoneMetrics(z).status === 'SAFE')
                                                    .map(z => (
                                                        <SelectItem key={z.zone_id} value={z.zone_id.toString()} className="py-3">
                                                            <div className="flex justify-between items-center w-full min-w-[200px]">
                                                                <span className="font-bold">{z.zone_name}</span>
                                                                <span className="text-xs text-muted-foreground bg-white/10 px-2 py-1 rounded">
                                                                    {z.active_riders} available
                                                                </span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {sourceZoneId && (
                                        <div className="mb-10 flex-1">
                                            <div className="flex justify-between items-end mb-4">
                                                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Fleet Transfer</h3>
                                                <span className="text-3xl font-black text-primary">{transferAmount[0]} <span className="text-lg text-muted-foreground font-medium">riders</span></span>
                                            </div>
                                            <Slider 
                                                defaultValue={[5]} 
                                                max={forecastData.find(z => z.zone_id.toString() === sourceZoneId)?.active_riders || 10} 
                                                step={1}
                                                onValueChange={setTransferAmount}
                                                className="py-4"
                                            />
                                        </div>
                                    )}

                                    <Button 
                                        size="lg" 
                                        className="w-full h-16 text-lg font-black tracking-wider uppercase rounded-xl mt-auto"
                                        disabled={!sourceZoneId || rebalancing}
                                        onClick={handleRebalance}
                                    >
                                        {rebalancing ? <Loader2 className="w-6 h-6 animate-spin" /> : "Execute Redeployment"}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
}
