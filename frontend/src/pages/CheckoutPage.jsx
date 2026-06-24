import { useState, useEffect } from 'react';
import { ShoppingBag, MapPin, Clock, CreditCard, ArrowRight, ShieldAlert, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CheckoutPage() {
    const [forecastData, setForecastData] = useState([]);
    const [selectedZoneId, setSelectedZoneId] = useState("1");
    const [selectedSlot, setSelectedSlot] = useState(null);

    useEffect(() => {
        const cached = sessionStorage.getItem('cachedForecast');
        if (cached) {
            setForecastData(JSON.parse(cached));
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

    const getSlotStatus = (predictedDemand, capacity) => {
        const ratio = predictedDemand / capacity;
        if (ratio > 1.0) return { label: 'Unavailable', price: null, class: 'opacity-50 cursor-not-allowed grayscale bg-card', border: 'border-border', icon: ShieldAlert, textClass: 'text-red-500' };
        if (ratio >= 0.85) return { label: 'Fast Filling', price: '+$3.99', class: 'hover:border-yellow-500/50 hover:bg-yellow-500/5 cursor-pointer bg-card', border: 'border-yellow-500/30', icon: Zap, textClass: 'text-yellow-500' };
        return { label: 'Available', price: 'Free', class: 'hover:border-green-500/50 hover:bg-green-500/5 cursor-pointer bg-card', border: 'border-green-500/30', icon: Clock, textClass: 'text-green-500' };
    };

    return (
        <div className="flex-1 overflow-y-auto bg-background p-8 lg:p-12 relative h-full">
            <div className="max-w-5xl mx-auto">
                <h1 className="text-3xl font-black tracking-tight mb-8">Secure Checkout</h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    
                    {/* LEFT COLUMN: Delivery Details & Slots */}
                    <div className="lg:col-span-2 space-y-8">
                        
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
                                {activeZone?.hours.map((slot, idx) => {
                                    const status = getSlotStatus(slot.predicted_demand, activeZone.capacity);
                                    const isSelected = selectedSlot === idx;
                                    const isUnavailable = status.label === 'Unavailable';

                                    return (
                                        <div 
                                            key={idx}
                                            onClick={() => !isUnavailable && setSelectedSlot(idx)}
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
                                                <div className="flex items-center gap-1.5">
                                                    <status.icon className={`w-4 h-4 ${status.textClass}`} />
                                                    <span className={`text-sm font-semibold tracking-wide ${status.textClass}`}>
                                                        {status.label}
                                                    </span>
                                                </div>
                                                
                                                {isSelected && (
                                                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                                        <div className="w-2 h-2 bg-white rounded-full" />
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {isUnavailable && (
                                                <div className="absolute inset-0 bg-background/50 rounded-xl flex items-center justify-center backdrop-blur-[1px]">
                                                    <span className="bg-red-500/90 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                                        Slot Locked
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </div>

                    {/* RIGHT COLUMN: Order Summary */}
                    <div className="space-y-6">
                        <div className="bg-card/40 border border-border/40 rounded-2xl p-6 sticky top-8">
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
                                    {selectedSlot !== null ? (
                                        <span className="font-semibold text-primary">
                                            {getSlotStatus(activeZone.hours[selectedSlot].predicted_demand, activeZone.capacity).price}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground italic">Select a slot</span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex justify-between items-center mb-8">
                                <span className="font-bold text-lg">Total</span>
                                <span className="font-black text-2xl">
                                    {selectedSlot !== null && getSlotStatus(activeZone.hours[selectedSlot].predicted_demand, activeZone.capacity).price === '+$3.99' 
                                        ? '$27.45' 
                                        : '$23.46'}
                                </span>
                            </div>
                            
                            <Button className="w-full h-12 text-md font-bold rounded-xl shadow-lg shadow-primary/20" disabled={selectedSlot === null}>
                                Place Order <ArrowRight className="w-5 h-5 ml-2" />
                            </Button>
                            
                            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground font-medium">
                                <CreditCard className="w-4 h-4" />
                                Secure SSL Encrypted Payment
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
