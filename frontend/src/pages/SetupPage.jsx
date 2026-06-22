import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Rocket, CloudRain, Calendar, PartyPopper, Car, Users } from "lucide-react";

export default function SetupPage() {
    const navigate = useNavigate();

    // Default datetime to tomorrow at 12:00 PM
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 1);
    defaultDate.setHours(12, 0, 0, 0);
    const localIsoString = new Date(defaultDate.getTime() - (defaultDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

    const [simulationParams, setSimulationParams] = useState({
        dateTime: localIsoString,
        weather: "CLEAR", // or 1.0 depending on how you want to pass it
        traffic: "1.0",
        isFestival: false,
        fleetSize: 200,
    });


    const handleLaunch = () => {
        // Navigate to admin dashboard and pass the configuration state
        navigate('/admin', { state: simulationParams });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
            {/* Background glowing effect */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background z-0"></div>

            <Card className="w-full max-w-lg z-10 border-primary/20 shadow-2xl shadow-primary/10 bg-card/80 backdrop-blur-sm">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-2 border border-primary/20">
                        <Rocket className="w-8 h-8 text-primary" />
                    </div>
                    <CardTitle className="text-3xl font-bold tracking-tight">Mission Briefing</CardTitle>
                    <CardDescription className="text-muted-foreground text-lg">
                        Configure scenario parameters before launching the prediction engine.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-8 mt-4">
                    {/* Date & Time */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
                            <Calendar className="w-4 h-4 text-primary" />
                            Target Date & Time
                        </label>
                        <Input
                            type="datetime-local"
                            value={simulationParams.dateTime}
                            onChange={(e) => setSimulationParams({ ...simulationParams, dateTime: e.target.value })}
                            className="bg-muted/30 border-border/50 text-lg py-6 focus-visible:ring-primary"
                        />
                    </div>

                    {/* Weather */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
                            <CloudRain className="w-4 h-4 text-primary" />
                            Weather Condition
                        </label>
                        <Select
                            value={simulationParams.weather}
                            onValueChange={(val) => setSimulationParams({ ...simulationParams, weather: val })}
                        >
                            <SelectTrigger className="bg-muted/30 border-border/50 h-14 text-lg focus:ring-primary">
                                <SelectValue placeholder="Select weather..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CLEAR">Clear skies (Normal operations)</SelectItem>
                                <SelectItem value="RAIN">Heavy Rain (Increased delivery times)</SelectItem>
                                <SelectItem value="STORM">Severe Storm (Capacity reduced heavily)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Traffic */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
                            <Car className="w-4 h-4 text-primary" />
                            City Traffic Level
                        </label>
                        <Select
                            value={simulationParams.traffic}
                            onValueChange={(val) => setSimulationParams({ ...simulationParams, traffic: val })}
                        >
                            <SelectTrigger className="bg-muted/30 border-border/50 h-14 text-lg focus:ring-primary">
                                <SelectValue placeholder="Select traffic..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1.0">Normal Traffic (1.0x)</SelectItem>
                                <SelectItem value="1.2">Moderate Congestion (1.2x)</SelectItem>
                                <SelectItem value="1.5">Heavy Traffic (1.5x)</SelectItem>
                                <SelectItem value="2.0">Gridlock (2.0x)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Fleet Size */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold flex items-center justify-between text-foreground/90">
                            <span className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-primary" />
                                Total Active Fleet Size
                            </span>
                            <span className="text-primary font-bold">{simulationParams.fleetSize} Riders</span>
                        </label>
                        <Input
                            type="number"
                            min="50"
                            max="1000"
                            step="10"
                            value={simulationParams.fleetSize}
                            onChange={(e) => setSimulationParams({ ...simulationParams, fleetSize: parseInt(e.target.value) || 0 })}
                            className="bg-muted/30 border-border/50 h-14 text-lg focus-visible:ring-primary"
                        />
                        <p className="text-xs text-muted-foreground text-right">
                            ≈ {Math.floor(simulationParams.fleetSize / 8)} riders deployed per zone
                        </p>
                    </div>



                    {/* Festival / Holiday */}
                    <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
                                <PartyPopper className="w-4 h-4 text-primary" />
                                Active Festival / Holiday
                            </label>
                            <p className="text-xs text-muted-foreground">Applies high-demand surge multipliers.</p>
                        </div>
                        <Switch
                            checked={simulationParams.isFestival}
                            onCheckedChange={(checked) => setSimulationParams({ ...simulationParams, isFestival: checked })}
                            className="data-[state=checked]:bg-primary"
                        />
                    </div>
                </CardContent>

                <CardFooter className="pt-6 pb-8">
                    <Button
                        onClick={handleLaunch}
                        className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                        INITIALIZE SIMULATION
                        <Rocket className="w-5 h-5 ml-2" />
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
