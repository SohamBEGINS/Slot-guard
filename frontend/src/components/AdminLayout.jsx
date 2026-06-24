import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Map,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Rocket,
  Settings,
  BrainCircuit
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  {
    to: '/admin/zones',
    icon: LayoutGrid,
    label: 'Zone Intelligence',
  },
  {
    to: '/admin/map',
    icon: Map,
    label: 'Urban Activity Map',
  },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const navigate = useNavigate();

  const executeReset = () => {
    sessionStorage.clear(); // Wipe the cached state to guarantee a fresh start
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* ── CUSTOM WARNING MODAL ── */}
      {showWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border/50 shadow-2xl rounded-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-red-500 mb-3 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Reset Control Center?
            </h2>
            <p className="text-muted-foreground text-sm font-medium leading-relaxed mb-8">
              Leaving the dashboard will drop your current simulation session. You will need to reconfigure the parameters and launch a new simulation from scratch. Are you sure you want to proceed?
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" className="font-bold" onClick={() => setShowWarning(false)}>
                Cancel
              </Button>
              <Button variant="destructive" className="font-bold" onClick={executeReset}>
                Yes, Reset Session
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── SIDEBAR SPACER (Keeps space for collapsed state) ── */}
      <div className="w-16 shrink-0 z-0 bg-card/40 border-r border-border/40 hidden md:block" />

      {/* ── SIDEBAR ── */}
      <aside
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
        className={`fixed top-0 left-0 h-full flex flex-col border-r border-border/40 bg-[#15191c]/95 backdrop-blur-xl z-50 transition-[width] duration-300 ease-in-out shadow-2xl overflow-hidden ${collapsed ? 'w-16' : 'w-64'
          }`}
      >
        {/* Brand */}
        <div className="flex items-center px-5 py-5 border-b border-border/30 w-64 h-[65px]">
          <Rocket className="w-6 h-6 text-primary shrink-0" />
          <span className={`font-bold text-sm tracking-wide text-foreground ml-4 transition-opacity duration-300 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>
            SlotGuard
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-2 p-2 pt-6 w-64">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center rounded-xl px-3 py-3 text-sm font-bold transition-all ${isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className={`ml-4 truncate transition-opacity duration-300 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>
                {label}
              </span>
            </NavLink>
          ))}

          {/* Divider */}
          <div className="my-4 mx-2 border-t border-border/10" />

          {/* Settings / Setup */}
          <button
            onClick={() => setShowWarning(true)}
            className="flex items-center rounded-xl px-3 py-3 text-sm font-bold text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all w-full text-left"
          >
            <Settings className="w-5 h-5 shrink-0" />
            <span className={`ml-4 truncate transition-opacity duration-300 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>
              Mission Setup
            </span>
          </button>

          {/* Preview Checkout */}
          <button
            onClick={() => navigate('/admin/checkout')}
            className="flex items-center rounded-xl px-3 py-3 text-sm font-bold text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all w-full text-left"
          >
            <ShoppingCart className="w-5 h-5 shrink-0" />
            <span className={`ml-4 truncate transition-opacity duration-300 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>
              Preview Checkout
            </span>
          </button>
        </nav>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-auto bg-background">
        <Outlet />
      </main>
    </div>
  );
}
