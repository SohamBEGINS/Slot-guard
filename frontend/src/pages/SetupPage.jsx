import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Rocket, CloudRain, Calendar, PartyPopper, Car, Users, ShoppingBag } from "lucide-react";

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

    const handleLaunch = async () => {
        setIsLaunching(true);
        try {
            const payload = {
                target_time: new Date(simulationParams.dateTime).toISOString(),
                weather: simulationParams.weather,
                traffic: simulationParams.traffic,
                is_festival: simulationParams.isFestival,
                fleet_size: simulationParams.fleetSize,
                initial_orders: simulationParams.initialOrders,
            };
            const response = await fetch('http://localhost:8000/api/v1/simulation/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error('Initialization failed');
            // Persist params in sessionStorage so all admin pages can read them
            sessionStorage.setItem('simulationParams', JSON.stringify(simulationParams));
            navigate('/admin/zones');
        } catch (err) {
            console.error(err);
            alert('Failed to initialize simulation. Is the backend running?');
        } finally {
            setIsLaunching(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6 relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background z-0" />

            <Card className="w-full max-w-3xl z-10 border-primary/20 shadow-2xl shadow-primary/10 bg-card/80 backdrop-blur-sm">
                <CardHeader className="text-center space-y-2 pb-6">
                    <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-2 border border-primary/20">
                        <Rocket className="w-8 h-8 text-primary" />
                    </div>
                    <CardTitle className="text-3xl font-bold tracking-tight">Mission Briefing</CardTitle>
                    <CardDescription className="text-muted-foreground text-base">
                        Configure scenario parameters before launching the prediction engine.
                    </CardDescription>
                </CardHeader>

                <CardContent className="px-8 pb-6">
                    <div className="grid grid-cols-2 gap-0">

                        {/* ── LEFT COLUMN ── */}
                        <div className="space-y-8 pr-8 border-r border-border/40">

                            {/* Target Date & Time */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                                    <Calendar className="w-4 h-4 text-primary" />
                                    Target Date &amp; Time
                                </label>
                                <Input
                                    type="datetime-local"
                                    value={simulationParams.dateTime}
                                    onChange={(e) => setSimulationParams({ ...simulationParams, dateTime: e.target.value })}
                                    className="bg-muted/30 border-border/50 text-base py-5 focus-visible:ring-primary"
                                />
                                <p className="text-xs text-muted-foreground text-right">
                                    Sets the hour window for demand forecasting.
                                </p>
                            </div>

                            {/* Weather Condition */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                                    <CloudRain className="w-4 h-4 text-primary" />
                                    Weather Condition
                                </label>
                                <Select
                                    value={simulationParams.weather}
                                    onValueChange={(val) => setSimulationParams({ ...simulationParams, weather: val })}
                                >
                                    <SelectTrigger className="bg-muted/30 border-border/50 h-12 text-base focus:ring-primary">
                                        <SelectValue placeholder="Select weather..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CLEAR">Clear skies (Normal)</SelectItem>
                                        <SelectItem value="WINDY">Windy (Slight delays)</SelectItem>
                                        <SelectItem value="RAIN">Heavy Rain (Slower deliveries)</SelectItem>
                                        <SelectItem value="STORM">Severe Storm (Reduced capacity)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground text-right">
                                    Affects delivery speed &amp; capacity multiplier.
                                </p>
                            </div>

                            {/* City Traffic Level */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                                    <Car className="w-4 h-4 text-primary" />
                                    City Traffic Level
                                </label>
                                <Select
                                    value={simulationParams.traffic}
                                    onValueChange={(val) => setSimulationParams({ ...simulationParams, traffic: val })}
                                >
                                    <SelectTrigger className="bg-muted/30 border-border/50 h-12 text-base focus:ring-primary">
                                        <SelectValue placeholder="Select traffic..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="LOW">Normal Traffic</SelectItem>
                                        <SelectItem value="MEDIUM">Moderate Congestion</SelectItem>
                                        <SelectItem value="HIGH">Heavy Traffic</SelectItem>
                                        <SelectItem value="GRIDLOCK">Gridlock</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground text-right">
                                    Scales total order demand city-wide.
                                </p>
                            </div>

                        </div>

                        {/* ── RIGHT COLUMN ── */}
                        <div className="space-y-8 pl-8">

                            {/* Total Active Fleet Size */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold flex items-center justify-between text-foreground/80">
                                    <span className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-primary" />
                                        Total Active Fleet Size
                                    </span>
                                    <span className="text-primary font-bold text-sm">{simulationParams.fleetSize} Riders</span>
                                </label>
                                <Input
                                    type="number"
                                    min="50"
                                    max="1000"
                                    step="10"
                                    value={simulationParams.fleetSize}
                                    onChange={(e) => setSimulationParams({ ...simulationParams, fleetSize: parseInt(e.target.value) || 0 })}
                                    className="bg-muted/30 border-border/50 h-12 text-base focus-visible:ring-primary"
                                />
                                <p className="text-xs text-muted-foreground text-right">
                                    ≈ {Math.floor(simulationParams.fleetSize / 8)} riders per zone
                                </p>
                            </div>

                            {/* Initial City Orders */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold flex items-center justify-between text-foreground/80">
                                    <span className="flex items-center gap-2">
                                        <ShoppingBag className="w-4 h-4 text-primary" />
                                        Initial City Orders
                                    </span>
                                    <span className="text-primary font-bold text-sm">{simulationParams.initialOrders} Orders</span>
                                </label>
                                <Input
                                    type="number"
                                    min="50"
                                    max="1000"
                                    step="10"
                                    value={simulationParams.initialOrders}
                                    onChange={(e) => setSimulationParams({ ...simulationParams, initialOrders: parseInt(e.target.value) || 0 })}
                                    className="bg-muted/30 border-border/50 h-12 text-base focus-visible:ring-primary"
                                />
                                <p className="text-xs text-muted-foreground text-right">
                                    ≈ {Math.floor(simulationParams.initialOrders / 8)} orders injected per zone
                                </p>
                            </div>

                            {/* Active Festival / Holiday */}
                            <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors">
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                                        <PartyPopper className="w-4 h-4 text-primary" />
                                        Active Festival / Holiday
                                    </label>
                                    <p className="text-xs text-muted-foreground">Applies 2x demand surge.</p>
                                </div>
                                <Switch
                                    checked={simulationParams.isFestival}
                                    onCheckedChange={(checked) => setSimulationParams({ ...simulationParams, isFestival: checked })}
                                    className="data-[state=checked]:bg-primary"
                                />
                            </div>

                        </div>

                    </div>
                </CardContent>

                <CardFooter className="px-8 pt-2 pb-8">
                    <Button
                        onClick={handleLaunch}
                        disabled={isLaunching}
                        className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                        {isLaunching ? 'INITIALIZING...' : 'INITIALIZE SIMULATION'}
                        <Rocket className={`w-5 h-5 ml-2 ${isLaunching ? 'animate-spin' : ''}`} />
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
