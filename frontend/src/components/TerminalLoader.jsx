import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function TerminalLoader({ 
  activeIndex, 
  steps = [
    "Wiping active simulation states...",
    "Redistributing 200+ riders across zones...",
    "Connecting to DagsHub MLflow Server...",
    "Locating @champion weights for Delivery_Slot_Model...",
    "Downloading XGBoost model dependencies...",
    "Injecting model weights into server RAM...",
    "Activating Zone Intelligence endpoints..."
  ] 
}) {
  const currentStep = steps[Math.min(activeIndex, steps.length - 1)];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-black/80 border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.15)] rounded-2xl p-8 overflow-hidden flex flex-col items-center justify-center relative backdrop-blur-md"
      >
        {/* Sleek Progress Bar at top */}
        <div 
          className="absolute top-0 left-0 h-1 bg-emerald-500 transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.8)]" 
          style={{ width: `${((activeIndex + 1) / steps.length) * 100}%` }} 
        />

        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-6 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
        
        <div className="h-8 flex items-center justify-center w-full relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute font-mono text-sm md:text-base font-bold text-white text-center w-full drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] tracking-wide"
            >
              {currentStep}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
