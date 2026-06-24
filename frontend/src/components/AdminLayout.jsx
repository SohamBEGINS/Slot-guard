import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Map,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Rocket,
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
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* ── SIDEBAR SPACER (Keeps space for collapsed state) ── */}
      <div className="w-16 shrink-0 z-0 bg-card/40 border-r border-border/40 hidden md:block" />

      {/* ── SIDEBAR ── */}
      <aside
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
        className={`fixed top-0 left-0 h-full flex flex-col border-r border-border/40 bg-[#15191c]/95 backdrop-blur-xl z-50 transition-[width] duration-300 ease-in-out shadow-2xl overflow-hidden ${
          collapsed ? 'w-16' : 'w-64'
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
                `flex items-center rounded-xl px-3 py-3 text-sm font-bold transition-all ${
                  isActive
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

          {/* Preview Checkout */}
          <button
            onClick={() => navigate('/checkout')}
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
