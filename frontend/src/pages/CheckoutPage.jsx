import { useState, useEffect } from 'react';
import { ShoppingBag, MapPin, Clock, CreditCard, ArrowRight, ShieldAlert, Zap, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CheckoutPage() {
    const [forecastData, setForecastData] = useState([]);
    const [selectedZoneId, setSelectedZoneId] = useState("1");
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [evaluatingSlotIndex, setEvaluatingSlotIndex] = useState(null);
    const [evaluatedSlots, setEvaluatedSlots] = useState({}); // { index: CheckoutSlotResponse }
    const [zoneOverrides, setZoneOverrides] = useState({});
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        const cached = sessionStorage.getItem('cachedForecast');
        if (cached) {
            setForecastData(JSON.parse(cached));
        }
        const savedOverrides = sessionStorage.getItem('zoneOverrides');
        if (savedOverrides) {
            setZoneOverrides(JSON.parse(savedOverrides));
        }
    }, []);

    if (forecastData.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <p className="text-muted-foreground">No active simulation data. Please launch a session from Setup.</p>
            </div>
        );
    }

    const activeZone = forecastData.find(z => z.zone_id.toString() === selectedZoneId);

    const handleSlotClick = async (slot, idx) => {
        if (evaluatingSlotIndex !== null) return; // Prevent double click
        
        // If already evaluated, just select it if it's available
        if (evaluatedSlots[idx]) {
            if (evaluatedSlots[idx].is_available) {
                setSelectedSlot(idx);
                setIsModalOpen(true);
            }
            return;
        }

        setEvaluatingSlotIndex(idx);
        try {
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const cachedParamsStr = sessionStorage.getItem('cachedParams') || sessionStorage.getItem('simulationParams');
            const simParams = cachedParamsStr ? JSON.parse(cachedParamsStr) : {};
            const dateStr = simParams.dateTime ? simParams.dateTime.split('T')[0] : new Date().toISOString().split('T')[0];
            
            // Construct a proper datetime for the slot
            const slotTime = new Date(`${dateStr}T${slot.hour.toString().padStart(2, '0')}:00:00Z`);

            // Check if admin manually forced it open
            const overridesStr = sessionStorage.getItem('zoneOverrides');
            const overrides = overridesStr ? JSON.parse(overridesStr) : {};
            const slotKey = `${selectedZoneId}-${slot.hour}:00 - ${slot.hour + 1}:00`;
            const isForceOpened = overrides[slotKey] === true;

            const payload = {
                run_id: sessionStorage.getItem('active_run_id'),
                zone_id: parseInt(selectedZoneId),
                slot_time: slotTime.toISOString(),
                weather: simParams.weather || "CLEAR",
                traffic: simParams.traffic || "MEDIUM",
                is_festival: simParams.isFestival || false
            };

            const res = await fetch(`${API_BASE_URL}/api/v1/checkout/evaluate-slot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Evaluation failed");
            
            let result = await res.json();
            
            if (isForceOpened) {
                result.is_available = true;
                result.force_opened = true;
            }
            
            setEvaluatedSlots(prev => ({
                ...prev,
                [idx]: result
            }));

            if (result.is_available) {
                setSelectedSlot(idx);
                setIsModalOpen(true);
            }
            
        } catch (err) {
            console.error(err);
            // On error, mark as unavailable
            setEvaluatedSlots(prev => ({
                ...prev,
                [idx]: { is_available: false, error: true }
            }));
        } finally {
            setEvaluatingSlotIndex(null);
        }
    };

    const getSlotVisuals = (idx) => {
        const evalData = evaluatedSlots[idx];
        
        if (!evalData) {
            // Default unevaluated state
            return { label: 'Check Availability', price: null, class: 'hover:border-primary/50 hover:bg-primary/5 cursor-pointer bg-card', border: 'border-border/50', icon: Clock, textClass: 'text-muted-foreground' };
        }

        if (!evalData.is_available) {
            return { label: 'Unavailable', price: null, class: 'opacity-50 cursor-not-allowed grayscale bg-card', border: 'border-border', icon: ShieldAlert, textClass: 'text-red-500' };
        }

        if (evalData.force_opened) {
            return { label: 'Admin Overridden', price: 'Free', class: 'hover:border-yellow-500/50 hover:bg-yellow-500/5 cursor-pointer bg-yellow-500/10', border: 'border-yellow-500/50', icon: Zap, textClass: 'text-yellow-500', warningMsg: "Slot capacity exceeded but forced open by admin." };
        }

        if (evalData.surge_fee_active) {
            const delay = evalData.surge_fee_amount - 30; // Base ETA is 30
            return { 
                label: 'High Volume Delay', 
                price: 'Free', 
                class: 'hover:border-orange-500/50 hover:bg-orange-500/5 cursor-pointer bg-orange-500/10', 
                border: 'border-orange-500/50', 
                icon: Clock, 
                textClass: 'text-orange-500', 
                warningMsg: `ETA: 30 mins ${evalData.surge_fee_amount} mins (+${delay}m)` 
            };
        }

        const ratio = evalData.predicted_demand / evalData.live_capacity;
        if (ratio > 0.80) {
            return { label: 'Fast Filling', price: '+$3.99', class: 'hover:border-yellow-500/50 hover:bg-yellow-500/5 cursor-pointer bg-card', border: 'border-yellow-500/30', icon: Zap, textClass: 'text-yellow-500' };
        }

        return { label: 'Available', price: 'Free', class: 'hover:border-green-500/50 hover:bg-green-500/5 cursor-pointer bg-card', border: 'border-green-500/30', icon: Clock, textClass: 'text-green-500' };
    };

    return (
        <div className="flex-1 overflow-y-auto bg-background p-8 lg:p-12 relative h-full">
            <div className="max-w-5xl mx-auto">
                <h1 className="text-3xl font-black tracking-tight mb-8">Secure Checkout</h1>

                <div className="max-w-3xl mx-auto space-y-8">
                    {/* Address Selection */}
                    <div className="bg-card/40 border border-border/40 rounded-2xl p-6">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-primary" />
                            Delivery Address
                        </h2>
                        <p className="text-sm text-muted-foreground mb-4">
                            Select your neighborhood zone. The system will dynamically show live slot availability based on ML traffic predictions.
                        </p>
                        <Select value={selectedZoneId} onValueChange={(val) => {
                            setSelectedZoneId(val);
                            setSelectedSlot(null); // Reset slot on zone change
                        }}>
                            <SelectTrigger className="w-full bg-background border-border/50 h-12 rounded-xl text-md font-medium">
                                <SelectValue placeholder="Select a zone" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border/50">
                                {forecastData.map(zone => (
                                    <SelectItem key={zone.zone_id} value={zone.zone_id.toString()} className="font-medium">
                                        {zone.zone_name} - Central District
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Slot Selection */}
                    <div className="bg-card/40 border border-border/40 rounded-2xl p-6">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-primary" />
                            Select Delivery Slot
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {activeZone?.hours
                                .filter(slot => {
                                    const slotKey = `${activeZone.zone_id}-${slot.hour}:00 - ${slot.hour + 1}:00`;
                                    // Hide entirely if admin explicitly locked it
                                    return zoneOverrides[slotKey] !== false;
                                })
                                .map((slot, idx) => {
                                const status = getSlotVisuals(idx);
                                const isSelected = selectedSlot === idx;
                                const isEvaluating = evaluatingSlotIndex === idx;

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => handleSlotClick(slot, idx)}
                                        className={`relative border rounded-xl p-5 transition-all duration-200 ${status.class} ${status.border} ${isSelected ? '!border-primary ring-1 ring-primary/50 !bg-primary/5' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="font-bold text-lg">{slot.hour}:00 - {slot.hour + 1}:00</span>
                                            {status.price && (
                                                <span className={`font-black ${status.price === 'Free' ? 'text-green-500' : 'text-foreground'}`}>
                                                    {status.price}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1.5">
                                                    {isEvaluating ? (
                                                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <status.icon className={`w-4 h-4 ${status.textClass}`} />
                                                    )}
                                                    <span className={`text-sm font-semibold tracking-wide ${isEvaluating ? 'text-primary animate-pulse' : status.textClass}`}>
                                                        {isEvaluating ? 'Evaluating...' : status.label}
                                                    </span>
                                                </div>
                                                {status.warningMsg && (
                                                    <span className="text-xs font-semibold text-orange-500/90 mt-1" dangerouslySetInnerHTML={{ __html: status.warningMsg.replace('30 mins', '<del class="opacity-70">30 mins</del>').replace(/>(\d+ mins)</, '><strong>$1</strong><') }} />
                                                )}
                                            </div>

                                            {isSelected && (
                                                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                                    <div className="w-2 h-2 bg-white rounded-full" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL / MINI-PAGE FOR ORDER SUMMARY */}
            {isModalOpen && selectedSlot !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => setIsModalOpen(false)}
                    />
                    
                    {/* Modal Content */}
                    <div className="relative z-10 w-full max-w-md bg-card border border-border/50 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header Area with Status */}
                        <div className={`p-6 border-b border-border/50 ${getSlotVisuals(selectedSlot).class.includes('orange') ? 'bg-orange-500/10' : getSlotVisuals(selectedSlot).class.includes('yellow') ? 'bg-yellow-500/10' : 'bg-green-500/10'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    {(() => {
                                        const Icon = getSlotVisuals(selectedSlot).icon;
                                        return <Icon className={`w-6 h-6 ${getSlotVisuals(selectedSlot).textClass}`} />;
                                    })()}
                                    <h3 className={`text-xl font-black tracking-tight ${getSlotVisuals(selectedSlot).textClass}`}>
                                        {getSlotVisuals(selectedSlot).label}
                                    </h3>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="font-bold text-foreground">
                                Slot: {activeZone.hours[selectedSlot].hour}:00 - {activeZone.hours[selectedSlot].hour + 1}:00
                            </p>
                            {getSlotVisuals(selectedSlot).warningMsg && (
                                <p className="text-sm font-semibold text-orange-500/90 mt-2" dangerouslySetInnerHTML={{ __html: getSlotVisuals(selectedSlot).warningMsg.replace('30 mins', '<del class="opacity-70">30 mins</del>').replace(/>(\d+ mins)</, '><strong>$1</strong><') }} />
                            )}
                        </div>

                        {/* Order Summary */}
                        <div className="p-6">
                            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                                <ShoppingBag className="w-5 h-5 text-primary" />
                                Order Summary
                            </h2>

                            <div className="space-y-4 mb-6">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground font-medium">Fresh Organic Apples (x2)</span>
                                    <span className="font-semibold">$12.98</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground font-medium">Whole Wheat Bread</span>
                                    <span className="font-semibold">$4.49</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground font-medium">Almond Milk</span>
                                    <span className="font-semibold">$5.99</span>
                                </div>
                            </div>

                            <div className="border-t border-border/50 pt-4 space-y-3 mb-6">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span className="font-semibold">$23.46</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Delivery Fee</span>
                                    <span className="font-semibold text-primary">
                                        {getSlotVisuals(selectedSlot).price}
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center mb-8">
                                <span className="font-bold text-lg">Total</span>
                                <span className="font-black text-3xl">
                                    {getSlotVisuals(selectedSlot).price === '+$3.99' ? '$27.45' : '$23.46'}
                                </span>
                            </div>

                            <Button className="w-full h-14 text-lg font-bold rounded-xl shadow-lg shadow-primary/20">
                                Place Order <ArrowRight className="w-5 h-5 ml-2" />
                            </Button>

                            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground font-medium">
                                <CreditCard className="w-4 h-4" />
                                Secure SSL Encrypted Payment
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
