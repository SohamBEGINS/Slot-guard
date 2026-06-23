import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, Cell } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ArrowLeft, Loader2, AlertTriangle, ShieldCheck, Lock } from "lucide-react";

export default function AdminDashboard() {
    const location = useLocation();
    const navigate = useNavigate();

    // Grab the setup params passed from SetupPage
    const simulationParams = location.state || {};

    const [forecastData, setForecastData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // If someone goes to /admin directly without setting up, kick them back
        if (!simulationParams.dateTime) {
            navigate('/');
            return;
        }

        const fetchForecast = async () => {
            try {
                // Pass the setup parameters to the new endpoint
                const queryParams = new URLSearchParams({
                    target_time: simulationParams.dateTime,
                    weather: simulationParams.weather,
                    traffic: simulationParams.traffic,
                    is_festival: simulationParams.isFestival
                });

                const res = await fetch(`http://localhost:8000/api/v1/simulation/demand-forecast?${queryParams}`);
                const data = await res.json();
                setForecastData(data.forecast);
            } catch (err) {
                console.error("Failed to fetch forecast:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchForecast();
    }, [simulationParams, navigate]);

    // Color logic for the bars
    const getStatusColor = (status) => {
        switch (status) {
            case 'LOCKED': return '#ef4444'; // Red
            case 'RISK': return '#eab308';   // Yellow
            default: return '#22c55e';       // Green
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'LOCKED': return <Lock className="w-4 h-4 text-red-500" />;
            case 'RISK': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
            default: return <ShieldCheck className="w-4 h-4 text-green-500" />;
        }
    };

    const chartConfig = {
        predicted_demand: {
            label: "Predicted Demand",
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background text-primary gap-4">
                <Loader2 className="w-12 h-12 animate-spin" />
                <h2 className="text-xl font-bold animate-pulse">XGBoost is computing 48 predictions...</h2>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-8">
            {/* HEADER */}
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-border/40">
                <div>
                    <Button variant="ghost" onClick={() => navigate('/')} className="mb-2 -ml-4 text-muted-foreground">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Setup
                    </Button>
                    <h1 className="text-4xl font-extrabold tracking-tight">Fleet Command Center</h1>
                    <p className="text-muted-foreground mt-2">
                        6-Hour Predictive Demand vs Live Fleet Capacity
                    </p>
                </div>

                <div className="flex gap-4">
                    <Badge variant="outline" className="h-10 px-4 text-sm bg-primary/10 border-primary/20">
                        Weather: {simulationParams.weather}
                    </Badge>
                    <Badge variant="outline" className="h-10 px-4 text-sm bg-primary/10 border-primary/20">
                        Traffic: {simulationParams.traffic}
                    </Badge>
                    {simulationParams.isFestival && (
                        <Badge variant="default" className="h-10 px-4 text-sm bg-indigo-500 hover:bg-indigo-600">
                            Festival Surge Active
                        </Badge>
                    )}
                </div>
            </div>

            {/* CHARTS GRID */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {forecastData.map((zone) => (
                    <Card key={zone.zone_id} className="border-border/40 shadow-xl bg-card/50 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-xl font-bold">{zone.zone_name}</CardTitle>
                                <Badge variant="secondary">Capacity: {zone.capacity} / hr</Badge>
                            </div>
                        </CardHeader>

                        <CardContent>
                            <div className="mt-4">
                                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                                    <BarChart accessibilityLayer data={zone.hours} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="slot" tickLine={false} tickMargin={10} axisLine={false} />
                                        <YAxis />
                                        <ChartTooltip content={<ChartTooltipContent />} cursor={false} />

                                        {/* Max Capacity Line */}
                                        <ReferenceLine y={zone.capacity} stroke="#ef4444" strokeDasharray="5 5" label={{ position: 'top', value: 'Max Capacity', fill: '#ef4444', fontSize: 12 }} />

                                        <Bar dataKey="predicted_demand" radius={[4, 4, 0, 0]}>
                                            {zone.hours.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={getStatusColor(entry.status)} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ChartContainer>
                            </div>

                            {/* Summary Table below chart */}
                            <div className="mt-6 pt-4 border-t border-border/40 grid grid-cols-6 gap-2 text-center text-sm">
                                {zone.hours.map((h, i) => (
                                    <div key={i} className="flex flex-col items-center gap-1">
                                        <span className="text-muted-foreground text-xs">{h.slot}</span>
                                        <span className="font-bold">{h.predicted_demand}</span>
                                        {getStatusIcon(h.status)}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
