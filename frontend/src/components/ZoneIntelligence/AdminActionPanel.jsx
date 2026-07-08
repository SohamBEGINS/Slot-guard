import React from 'react';
import { Button } from "@/components/ui/button";
import { Zap, Users } from "lucide-react";

/**
 * AdminActionPanel
 *
 * Props:
 *   incentiveBonus        – number, current slider value
 *   setIncentiveBonus     – setter
 *   onDeploySurge         – async () => void  (caller owns loading + notif logic)
 *   onSteerDemand         – async () => void
 */
export default function AdminActionPanel({
    incentiveBonus,
    setIncentiveBonus,
    onDeploySurge,
    onSteerDemand,
}) {
    return (
        <div className="flex flex-wrap items-center justify-between bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl px-6 py-4 shadow-xl mb-6 shrink-0 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 opacity-50" />

            {/* Left – Surge Incentive slider + Deploy button */}
            <div className="flex items-center gap-6 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20">
                        <Zap className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1">
                            Rider Surge Incentive
                        </p>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-indigo-400 w-12">₹{incentiveBonus}</span>
                            <input
                                type="range"
                                min="10"
                                max="100"
                                step="10"
                                value={incentiveBonus}
                                onChange={(e) => setIncentiveBonus(parseInt(e.target.value))}
                                className="w-32 accent-indigo-500 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                <Button
                    size="sm"
                    className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-6 shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all hover:scale-105"
                    onClick={onDeploySurge}
                >
                    Deploy Surge
                </Button>
            </div>

            {/* Right – Steer Demand button */}
            <div className="flex items-center gap-4 relative z-10">
                <Button
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6 h-10 shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all hover:scale-105"
                    onClick={onSteerDemand}
                >
                    <Users className="w-4 h-4 mr-2" />
                    Steer Demand (Auto)
                </Button>
            </div>
        </div>
    );
}
