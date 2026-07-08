import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, ShieldCheck, Lock } from "lucide-react";

function getStatusIcon(status) {
    switch (status) {
        case 'LOCKED': return <Lock className="w-5 h-5 text-red-500" />;
        case 'RISK':   return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
        default:       return <ShieldCheck className="w-5 h-5 text-green-500" />;
    }
}

function getStatusColorCls(status) {
    if (status === 'LOCKED') return 'text-red-500';
    if (status === 'RISK')   return 'text-yellow-500';
    return 'text-green-500';
}

function getAlertText(status) {
    if (status === 'LOCKED') return 'CRITICAL - COLLISION PREDICTED';
    if (status === 'RISK')   return 'WARNING - HIGH LOAD';
    return 'SAFE - OPTIMAL';
}

/**
 * SlotStatusTable
 *
 * Props:
 *   activeZone        – zone object ({ zone_id, zone_name, active_riders, capacity, hours })
 *   overrides         – { "zoneId-slot": boolean }
 *   onToggleOverride  – (zoneId, slot, currentIsOpen) => void
 */
export default function SlotStatusTable({ activeZone, overrides, onToggleOverride }) {
    return (
        <Card className="xl:col-span-7 border-border/40 shadow-xl bg-[#1e2329] flex flex-col overflow-hidden min-h-0">
            <CardHeader className="border-b border-border/10 bg-[#1a1f24] py-4 shrink-0">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-xs tracking-widest text-muted-foreground uppercase font-black">
                            Slot Configuration Manager
                        </CardTitle>
                        <p className="text-xs text-primary mt-1 font-semibold">
                            ZONE: {activeZone.zone_name.toUpperCase()}
                        </p>
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
                            const defaultIsOpen = h.status !== 'LOCKED';
                            const currentIsOpen = overrides[key] !== undefined ? overrides[key] : defaultIsOpen;

                            return (
                                <tr
                                    key={i}
                                    className={`hover:bg-white/5 transition-colors ${!currentIsOpen ? 'opacity-60 bg-black/20' : ''}`}
                                >
                                    <td className="px-6 py-4 font-bold text-base whitespace-nowrap">{h.slot}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-muted-foreground font-medium">{h.current_load} Orders</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`font-black text-lg ${h.status === 'LOCKED' ? 'text-red-400' : ''}`}>
                                            {h.predicted_demand}{' '}
                                            <span className="text-xs font-medium text-muted-foreground ml-1">Predicted</span>
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
                                                <span className="text-xs text-muted-foreground">Capacity Exceeded</span>
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
                                            <Switch
                                                checked={currentIsOpen}
                                                onCheckedChange={() => onToggleOverride(activeZone.zone_id, h.slot, currentIsOpen)}
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
    );
}
