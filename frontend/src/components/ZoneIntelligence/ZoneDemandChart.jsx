import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

/**
 * Returns the hex fill for a bar based on slot status and override state.
 */
function getChartStatusColor(status) {
    switch (status) {
        case 'LOCKED': return '#ef4444';
        case 'RISK':   return '#eab308';
        default:       return '#22c55e';
    }
}

/**
 * ZoneDemandChart
 *
 * Props:
 *   activeZone  – the zone object ({ zone_name, capacity, hours: [...] })
 *   overrides   – { "zoneId-slot": boolean }
 */
export default function ZoneDemandChart({ activeZone, overrides }) {
    return (
        <Card className="xl:col-span-5 border-border/40 shadow-xl bg-card/40 backdrop-blur-md flex flex-col min-h-0">
            <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-lg font-bold tracking-wide">
                    {activeZone.zone_name} Demand Trend
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center min-h-0 pb-2">
                <div className="h-full w-full min-h-[250px]">
                    <ChartContainer
                        config={{ predicted_demand: { label: "Demand" } }}
                        className="h-full w-full"
                    >
                        <BarChart
                            accessibilityLayer
                            data={activeZone.hours}
                            margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                            <XAxis
                                dataKey="slot"
                                tickLine={false}
                                tickMargin={10}
                                axisLine={false}
                                tick={{ fontSize: 11 }}
                            />
                            <YAxis tick={{ fontSize: 11 }} />
                            <ChartTooltip
                                content={<ChartTooltipContent />}
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            />
                            <ReferenceLine
                                y={activeZone.capacity}
                                stroke="#ef4444"
                                strokeDasharray="5 5"
                                strokeWidth={1.5}
                                label={{
                                    position: 'top',
                                    value: `Max Capacity: ${activeZone.capacity}`,
                                    fill: '#ef4444',
                                    fontSize: 12,
                                    fontWeight: 'bold'
                                }}
                            />
                            <Bar dataKey="predicted_demand" radius={[4, 4, 0, 0]} maxBarSize={60}>
                                {activeZone.hours.map((entry, index) => {
                                    const key = `${activeZone.zone_id}-${entry.slot}`;
                                    const isForceClosed = overrides[key] === false;
                                    const fill = isForceClosed ? '#4b5563' : getChartStatusColor(entry.status);
                                    return <Cell key={`cell-${index}`} fill={fill} />;
                                })}
                            </Bar>
                        </BarChart>
                    </ChartContainer>
                </div>
            </CardContent>
        </Card>
    );
}
