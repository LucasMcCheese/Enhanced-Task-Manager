import { AlertTriangle, CheckCircle2, Gauge } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { BootImpact, StartupAppEntry } from '../services/systemService';
import { ProcessIcon } from './ProcessIcon';

interface StartupAppsViewProps {
  apps: StartupAppEntry[];
  onToggleApp: (app: StartupAppEntry) => void;
}

type StartupFilter = 'All' | 'Enabled' | 'Disabled';

function ImpactBadge({ impact }: { impact: BootImpact }) {
  if (impact === 'High') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-red-500/15 text-red-300 border border-red-500/25 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>High impact</span>
      </span>
    );
  }
  if (impact === 'Medium') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/25 whitespace-nowrap">
        <Gauge className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Medium impact</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/12 text-emerald-300 border border-emerald-500/20 whitespace-nowrap">
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>Low impact</span>
    </span>
  );
}

export function StartupAppsView({ apps, onToggleApp }: StartupAppsViewProps) {
  const [filter, setFilter] = useState<StartupFilter>('All');

  const enabledCount = apps.filter((a) => a.enabled).length;
  const highImpactEnabled = apps.filter((a) => a.enabled && a.impact === 'High').length;
  const totalBootSeconds = apps
    .filter((a) => a.enabled)
    .reduce((sum, a) => sum + a.lastBootSeconds, 0);

  const visibleApps = useMemo(() => {
    if (filter === 'Enabled') return apps.filter((a) => a.enabled);
    if (filter === 'Disabled') return apps.filter((a) => !a.enabled);
    return apps;
  }, [apps, filter]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="px-6 pt-6 pb-4 border-b border-white/[0.06] flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
            Startup Apps
          </h2>
          <p className="text-xs text-zinc-400 mt-1 flex flex-wrap items-center gap-2 tabular-nums">
            <span>{enabledCount} enabled</span>
            <span aria-hidden="true">·</span>
            <span>{apps.length - enabledCount} disabled</span>
            <span aria-hidden="true">·</span>
            <span>{highImpactEnabled} high impact active</span>
            <span aria-hidden="true">·</span>
            <span>Last BIOS & app boot impact {totalBootSeconds.toFixed(1)}s</span>
          </p>
        </div>

        <div
          role="group"
          aria-label="Filter startup applications"
          className="flex items-center gap-1 p-1 rounded-lg bg-[#1C1C20] border border-white/[0.07]"
        >
          {(['All', 'Enabled', 'Disabled'] as StartupFilter[]).map((opt) => {
            const active = filter === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setFilter(opt)}
                aria-pressed={active}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active ? 'bg-white/[0.11] text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="rounded-xl bg-[#1B1B1F]/80 backdrop-blur-xl border border-white/[0.08] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[660px]">
              <thead>
                <tr className="border-b border-white/[0.07] bg-[#1F1F24]/90 text-[12px] font-medium text-zinc-400">
                  <th scope="col" className="py-3 pl-4 pr-3">
                    Startup item
                  </th>
                  <th scope="col" className="py-3 px-3">
                    Publisher
                  </th>
                  <th scope="col" className="py-3 px-3">
                    Startup impact
                  </th>
                  <th scope="col" className="py-3 px-3 text-right">
                    Boot time
                  </th>
                  <th scope="col" className="py-3 pl-3 pr-4 text-right">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.045] text-[13px]">
                {visibleApps.map((app) => (
                  <tr key={app.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-3 pl-4 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.06] flex items-center justify-center shrink-0">
                          <ProcessIcon id={app.id} className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-zinc-100 truncate">{app.name}</div>
                          <div className="text-[11px] text-zinc-400 font-mono truncate">
                            {app.executable}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-xs text-zinc-400">{app.publisher}</td>
                    <td className="py-3 px-3">
                      <ImpactBadge impact={app.impact} />
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs text-zinc-300 tabular-nums">
                      {app.enabled ? `${app.lastBootSeconds.toFixed(1)} s` : '—'}
                    </td>
                    <td className="py-3 pl-3 pr-4 text-right">
                      <div className="inline-flex items-center justify-end gap-3">
                        <span
                          className={`text-xs font-medium w-14 text-right ${
                            app.enabled ? 'text-zinc-100' : 'text-zinc-500'
                          }`}
                        >
                          {app.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={app.enabled}
                          aria-label={`${app.enabled ? 'Disable' : 'Enable'} ${app.name} at startup`}
                          onClick={() => onToggleApp(app)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60CDFF] ${
                            app.enabled
                              ? 'bg-[#60CDFF] border-[#60CDFF]'
                              : 'bg-[#26262C] border-white/[0.16] hover:border-white/[0.28]'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4 w-4 rounded-full shadow transition-transform duration-150 ${
                              app.enabled
                                ? 'translate-x-[22px] bg-[#111315]'
                                : 'translate-x-[3px] bg-zinc-300'
                            }`}
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
