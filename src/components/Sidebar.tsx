import {
  Activity,
  HardDrive,
  History,
  LayoutGrid,
  Menu,
  Pause,
  Play,
  Power,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { TabId } from '../services/systemService';

export interface NavItem {
  id: TabId;
  label: string;
  icon: typeof LayoutGrid;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'processes', label: 'Processes', icon: LayoutGrid },
  { id: 'performance', label: 'Performance', icon: Activity },
  { id: 'app-history', label: 'App History', icon: History },
  { id: 'startup-apps', label: 'Startup Apps', icon: Power },
  { id: 'storage-analyzer', label: 'Storage Analyzer', icon: HardDrive },
];

interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  refreshMs: number;
  isPaused: boolean;
  onTogglePause: () => void;
  onChangeRefreshMs: (ms: number) => void;
  processCount: number;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  refreshMs,
  isPaused,
  onTogglePause,
  onChangeRefreshMs,
  processCount,
}: SidebarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (id: TabId) => {
    onSelectTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile / Narrow Top Header */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#1A1A1D]/90 backdrop-blur-xl border-b border-white/[0.08] sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[#60CDFF]/15 border border-[#60CDFF]/30 flex items-center justify-center">
            <Activity className="w-4 h-4 text-[#60CDFF]" aria-hidden="true" />
          </div>
          <span className="font-display font-semibold text-sm tracking-normal text-zinc-100 whitespace-nowrap">
            Task Manager
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePause}
            aria-label={isPaused ? 'Resume live updates' : 'Pause live updates'}
            className="p-2 rounded-lg text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60CDFF]"
          >
            {isPaused ? (
              <Play className="w-4 h-4 text-[#60CDFF]" aria-hidden="true" />
            ) : (
              <Pause className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            className="p-2 rounded-lg text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60CDFF]"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[53px] z-40 bg-[#1B1B1F]/95 backdrop-blur-2xl border-b border-white/[0.08] p-3 shadow-2xl">
          <nav aria-label="Task Manager sections" className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-white/[0.08] text-white'
                      : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200'
                  }`}
                >
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[#60CDFF]"
                    />
                  )}
                  <Icon
                    className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#60CDFF]' : 'text-zinc-400'}`}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* Desktop Mica / Acrylic Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 xl:w-64 shrink-0 bg-[#1A1A1E]/95 border-r border-white/[0.07] select-none">
        <div className="px-5 pt-5 pb-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#60CDFF]/12 border border-[#60CDFF]/25 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-[#60CDFF]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-sm font-semibold text-zinc-100 tracking-normal truncate">
              Task Manager
            </h1>
            <p className="text-xs text-zinc-400 truncate tabular-nums">
              {processCount} active processes
            </p>
          </div>
        </div>

        <nav aria-label="Task Manager sections" className="flex-1 px-2.5 py-2 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60CDFF] ${
                  isActive
                    ? 'bg-white/[0.07] text-white'
                    : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-[#60CDFF]"
                  />
                )}
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-[#60CDFF]' : 'text-zinc-400 group-hover:text-zinc-200'
                  }`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Update Speed / Pause Control */}
        <div className="p-3 m-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Update speed</span>
            <button
              type="button"
              onClick={onTogglePause}
              aria-label={isPaused ? 'Resume live telemetry' : 'Pause live telemetry'}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-white/[0.06] hover:bg-white/[0.11] text-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60CDFF]"
            >
              {isPaused ? (
                <>
                  <Play className="w-3 h-3 text-[#60CDFF]" aria-hidden="true" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause className="w-3 h-3 text-zinc-300" aria-hidden="true" />
                  <span>Pause</span>
                </>
              )}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-[#141416] border border-white/[0.06]">
            {[
              { label: 'High', ms: 750 },
              { label: 'Normal', ms: 1200 },
              { label: 'Low', ms: 2500 },
            ].map((opt) => {
              const selected = !isPaused && refreshMs === opt.ms;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => onChangeRefreshMs(opt.ms)}
                  className={`py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                    selected
                      ? 'bg-white/[0.1] text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}
