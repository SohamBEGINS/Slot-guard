import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, Package, TrendingUp } from "lucide-react";

export default function ZoneSummaryCards({
    forecastData,
    activeZoneId,
    setActiveZoneId,
    activeZone,
    simulationParams,
    peakDemand,
    peakHoursDisplay,
}) {
    return (
        <>
            {/* Header row: title + env badges */}
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

            {/* Zone selector + stat cards */}
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
                    {/* Active Riders */}
                    <div className="flex items-center gap-3 bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl px-6 py-3 shadow-md flex-1">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-0.5">Active Riders</p>
                            <p className="text-2xl font-black leading-none">{activeZone.active_riders}</p>
                        </div>
                    </div>

                    {/* Base Capacity */}
                    <div className="flex items-center gap-3 bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl px-6 py-3 shadow-md flex-1">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <Package className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-0.5">Base Capacity</p>
                            <p className="text-2xl font-black leading-none">
                                {activeZone.capacity} <span className="text-base font-medium text-muted-foreground">/ hr</span>
                            </p>
                        </div>
                    </div>

                    {/* Predicted Peak */}
                    <div className={`flex items-center gap-3 backdrop-blur-md border rounded-2xl px-6 py-3 shadow-md flex-1 ${peakDemand > activeZone.capacity ? 'bg-red-500/10 border-red-500/30' : 'bg-card/60 border-border/50'}`}>
                        <div className={`p-2 rounded-full ${peakDemand > activeZone.capacity ? 'bg-red-500/20' : 'bg-primary/10'}`}>
                            <TrendingUp className={`w-5 h-5 ${peakDemand > activeZone.capacity ? 'text-red-500' : 'text-primary'}`} />
                        </div>
                        <div>
                            <p className={`text-xs uppercase tracking-widest font-semibold mb-0.5 ${peakDemand > activeZone.capacity ? 'text-red-500/80' : 'text-muted-foreground'}`}>
                                Predicted Peak
                            </p>
                            <div className="flex items-baseline gap-2">
                                <p className={`text-2xl font-black leading-none ${peakDemand > activeZone.capacity ? 'text-red-500' : ''}`}>
                                    {peakDemand}
                                </p>
                                <span className={`text-xs font-semibold ${peakDemand > activeZone.capacity ? 'text-red-400' : 'text-muted-foreground'}`}>
                                    at {peakHoursDisplay}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
