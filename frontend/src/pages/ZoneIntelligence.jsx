import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from "lucide-react";


import ZoneSummaryCards  from '../components/ZoneIntelligence/ZoneSummaryCards';
import AdminActionPanel  from '../components/ZoneIntelligence/AdminActionPanel';
import ZoneDemandChart   from '../components/ZoneIntelligence/ZoneDemandChart';
import SlotStatusTable   from '../components/ZoneIntelligence/SlotStatusTable';

// ─── Terminal-loader step arrays ─────────────────────────────────────────────
const FORECAST_STEPS = [
    "Analyzing historical base demand...",
    "Applying Sine/Cosine temporal encoding...",
    "Injecting weather and traffic severity floats...",
    "XGBoost computing predictive tensors...",
    "Updating Urban Activity Map..."
];

const SURGE_STEPS = [
    "Triggering dynamic price surge protocol...",
    "Suppressing 15% of checkout demand...",
    "Recalculating Zone capacity threshold...",
    "Recomputing XGBoost predictions...",
    "Applying UI capacity constraints..."
];

const INCENTIVE_STEPS = [
    "Calculating Sigmoid Conversion S-Curve...",
    "Pinging INACTIVE riders in local zone...",
    "Processing financial motivation triggers...",
    "Deploying Standby Fleet & recalculating capacity..."
];

const STEER_STEPS = [
    "Running ML Binary Search Solver...",
    "Identifying optimal future capacity thresholds...",
    "Redistributing exact non-linear excess demand...",
    "Verifying cascading capacity constraints..."
];
// ─────────────────────────────────────────────────────────────────────────────

export default function ZoneIntelligence() {
    const navigate = useNavigate();

    // ── Simulation params (read-only from session) ──────────────────────────
    const [simulationParams] = useState(() =>
        JSON.parse(sessionStorage.getItem('simulationParams') || '{}')
    );

    // ── UI state ─────────────────────────────────────────────────────────────
    const [loading, setLoading]               = useState(true);
    const [loadingSteps, setLoadingSteps]     = useState(FORECAST_STEPS);
    const [loadingStepIndex, setLoadingStepIndex] = useState(0);
    const [incentiveBonus, setIncentiveBonus] = useState(40);
    const [notification, setNotification]     = useState(null); // { type, message }

    // ── Data state ────────────────────────────────────────────────────────────
    const [forecastData, setForecastData]   = useState([]);
    const [activeZoneId, setActiveZoneId]   = useState("1");
    const [overrides, setOverrides]         = useState(() => {
        const saved = sessionStorage.getItem('zoneOverrides');
        return saved ? JSON.parse(saved) : {};
    });

    // ── Loader orchestration ─────────────────────────────────────────────────
    const executeWithLoader = async (stepsArray, apiCall) => {
        setLoadingSteps(stepsArray);
        setLoadingStepIndex(0);
        setLoading(true);

        let currentStep = 0;
        let isApiDone = false;

        const tick = () => {
            if (isApiDone) return;
            currentStep++;
            if (currentStep < stepsArray.length - 2) {
                setLoadingStepIndex(currentStep);
                setTimeout(tick, 800);
            }
        };
        setTimeout(tick, 800);

        try {
            await apiCall();

            isApiDone = true;
            const fastForward = async () => {
                while (currentStep < stepsArray.length - 1) {
                    currentStep++;
                    setLoadingStepIndex(currentStep);
                    await new Promise(r => setTimeout(r, 200));
                }
                setTimeout(() => setLoading(false), 300);
            };
            fastForward();
        } catch (err) {
            console.error(err);
            isApiDone = true;
            setLoading(false);
        }
    };

    // ── Forecast fetch ────────────────────────────────────────────────────────
    const rawFetchForecast = async () => {
        const queryParams = new URLSearchParams({
            run_id:      sessionStorage.getItem('active_run_id'),
            target_time: simulationParams.dateTime,
            weather:     simulationParams.weather,
            traffic:     simulationParams.traffic,
            is_festival: simulationParams.isFestival
        });
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const res  = await fetch(`${API_BASE_URL}/api/v1/simulation/demand-forecast?${queryParams}`);
        const data = await res.json();

        setForecastData(data.forecast);
        sessionStorage.setItem('cachedParams',   JSON.stringify(simulationParams));
        sessionStorage.setItem('cachedForecast', JSON.stringify(data.forecast));
    };

    const fetchForecast = async (force = false) => {
        const cachedParams  = sessionStorage.getItem('cachedParams');
        const cachedData    = sessionStorage.getItem('cachedForecast');
        const currentParamsStr = JSON.stringify(simulationParams);

        if (!force && cachedParams === currentParamsStr && cachedData) {
            setForecastData(JSON.parse(cachedData));
            setLoading(false);
            return;
        }
        await executeWithLoader(FORECAST_STEPS, rawFetchForecast);
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        if (!sessionStorage.getItem('active_run_id')) {
            navigate('/');
            return;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
        fetchForecast();
    }, []);

    // ── Action Override toggle ────────────────────────────────────────────────
    const handleToggleOverride = (zoneId, slot, currentIsOpen) => {
        const key = `${zoneId}-${slot}`;
        setOverrides(prev => {
            const nextState = { ...prev, [key]: !currentIsOpen };
            sessionStorage.setItem('zoneOverrides', JSON.stringify(nextState));
            return nextState;
        });
    };

    // ── Notification helper ───────────────────────────────────────────────────
    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    };

    // ── Deploy Surge handler ──────────────────────────────────────────────────
    const handleDeploySurge = async () => {
        let notifData = null;
        const apiCall = async () => {
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const res = await fetch(`${API_BASE_URL}/api/v1/simulation/deploy-incentive`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    run_id:       sessionStorage.getItem('active_run_id'),
                    zone_id:      activeZone.zone_id,
                    bonus_amount: incentiveBonus
                })
            });
            notifData = await res.json();
            await rawFetchForecast();
        };

        await executeWithLoader(INCENTIVE_STEPS, apiCall);
        await new Promise(r => setTimeout(r, 300));

        if (notifData) {
            if (notifData.woke_up > 0) {
                showNotification('success', `${notifData.woke_up} riders are now ONLINE in ${activeZone.zone_name}! (${notifData.conversion_pct}% conversion)`);
            } else {
                showNotification('warn', `Bonus too low — no riders responded. Try increasing the amount!`);
            }
        }
    };

    // ── Steer Demand handler ──────────────────────────────────────────────────
    const handleSteerDemand = async () => {
        let steerNotifData = null;
        const apiCall = async () => {
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

            const peakSlotHour = parseInt(peakHours[0]);
            const peakSlot     = activeZone.hours.find(h => h.hour === peakSlotHour);

            const headrooms = {};
            activeZone.hours.forEach(h => {
                if (h.hour > peakSlotHour) {
                    headrooms[h.hour.toString()] =
                        h.true_headroom !== undefined
                            ? h.true_headroom
                            : Math.max(0, activeZone.capacity - h.predicted_demand);
                }
            });

            if (peakSlot && peakSlot.predicted_demand > activeZone.capacity) {
                const excess = peakSlot.true_excess !== undefined
                    ? peakSlot.true_excess
                    : (peakSlot.predicted_demand - activeZone.capacity);

                if (excess > 0) {
                    const res = await fetch(`${API_BASE_URL}/api/v1/simulation/steer-demand`, {
                        method:  'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            run_id:          sessionStorage.getItem('active_run_id'),
                            zone_id:         activeZone.zone_id,
                            from_hour:       peakSlotHour,
                            excess_orders:   excess,
                            target_headrooms: headrooms
                        })
                    });
                    steerNotifData = await res.json();
                }
            } else {
                steerNotifData = {
                    message:          "Zone is within safe capacity limits. No steering required.",
                    orders_reassigned: 0,
                    already_safe:     true
                };
            }
            await rawFetchForecast();
        };

        await executeWithLoader(STEER_STEPS, apiCall);
        await new Promise(r => setTimeout(r, 300));

        if (steerNotifData) {
            if (steerNotifData.already_safe || steerNotifData.orders_reassigned > 0) {
                showNotification('success', steerNotifData.message);
            } else {
                showNotification('warn', `No headroom available in future slots. Deploy surge to raise capacity!`);
            }
        }
    };

    // ── Guard: loading / no data ──────────────────────────────────────────────
    if (!forecastData || forecastData.length === 0) {
        if (loading) {
            return (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-5">
                        <div className="relative w-14 h-14">
                            <div className="absolute inset-0 rounded-full border-2 border-border/20"/>
                            <div className="absolute inset-0 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin"/>
                        </div>
                        <p className="text-xs font-bold tracking-[0.3em] uppercase text-muted-foreground animate-pulse">Loading</p>
                    </div>
                </div>
            );
        }
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                No Data Available
            </div>
        );
    }

    // ── Derived values ────────────────────────────────────────────────────────
    const activeZone = forecastData.find(z => z.zone_id.toString() === activeZoneId) || forecastData[0];

    const peakDemand = Math.max(...activeZone.hours.map(h => h.predicted_demand));
    const peakHours  = activeZone.hours
        .filter(h => h.predicted_demand === peakDemand)
        .map(h => h.slot.split(' ')[0]);

    const peakHoursDisplay = peakHours.length > 2
        ? `${peakHours.slice(0, 2).join(', ')}...`
        : peakHours.join(', ');

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="p-6 flex flex-col min-h-[calc(100vh-2rem)] relative">
            {loading && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-5">
                        <div className="relative w-14 h-14">
                            <div className="absolute inset-0 rounded-full border-2 border-border/20"/>
                            <div className="absolute inset-0 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin"/>
                        </div>
                        <p className="text-xs font-bold tracking-[0.3em] uppercase text-muted-foreground animate-pulse">Loading</p>
                    </div>
                </div>
            )}

            {/* Toast notification */}
            {notification && (
                <div className={`fixed bottom-8 right-8 z-50 flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300 ${
                    notification.type === 'success'
                        ? 'bg-indigo-950/90 border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.3)]'
                        : 'bg-red-950/90 border-red-500/50'
                }`}>
                    <div className={`p-2 rounded-full ${notification.type === 'success' ? 'bg-indigo-500/20' : 'bg-red-500/20'}`}>
                        <Zap className={`w-5 h-5 ${notification.type === 'success' ? 'text-indigo-400' : 'text-red-400'}`} />
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-0.5">Surge Deployed</p>
                        <p className="text-sm font-bold text-white">{notification.message}</p>
                    </div>
                    <button
                        onClick={() => setNotification(null)}
                        className="ml-4 text-muted-foreground hover:text-white transition-colors text-lg leading-none"
                    >
                        &times;
                    </button>
                </div>
            )}

            {/* Zone selector + stat cards */}
            <ZoneSummaryCards
                forecastData={forecastData}
                activeZoneId={activeZoneId}
                setActiveZoneId={setActiveZoneId}
                activeZone={activeZone}
                simulationParams={simulationParams}
                peakDemand={peakDemand}
                peakHoursDisplay={peakHoursDisplay}
            />

            {/* Admin action bar */}
            <AdminActionPanel
                incentiveBonus={incentiveBonus}
                setIncentiveBonus={setIncentiveBonus}
                onDeploySurge={handleDeploySurge}
                onSteerDemand={handleSteerDemand}
            />

            {/* Chart + Table */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 min-h-0">
                <ZoneDemandChart
                    activeZone={activeZone}
                    overrides={overrides}
                />
                <SlotStatusTable
                    activeZone={activeZone}
                    overrides={overrides}
                    onToggleOverride={handleToggleOverride}
                />
            </div>
        </div>
    );
}
