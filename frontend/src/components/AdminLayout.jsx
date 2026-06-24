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
      {/* ── SIDEBAR ── */}
      <aside
        className={`relative flex flex-col border-r border-border/40 bg-card/60 backdrop-blur-sm transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-border/30">
          <Rocket className="w-6 h-6 text-primary shrink-0" />
          {!collapsed && (
            <span className="font-bold text-sm tracking-wide text-foreground truncate">
              SlotGuard
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-1 p-2 pt-4">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}

          {/* Divider */}
          <div className="my-2 border-t border-border/30" />

          {/* Preview Checkout */}
          <button
            onClick={() => navigate('/checkout')}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors w-full text-left"
          >
            <ShoppingCart className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="truncate">Preview Checkout</span>}
          </button>
        </nav>

        {/* Collapse Toggle */}
        <div className="p-2 border-t border-border/30">
          <Button
            variant="ghost"
            size="sm"
            className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
