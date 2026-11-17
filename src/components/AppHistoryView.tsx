import { Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatCpuTime, type AppHistoryEntry } from '../services/systemService';
import { ProcessIcon } from './ProcessIcon';

interface AppHistoryViewProps {
  history: AppHistoryEntry[];
  onResetHistory: () => void;
}

export function AppHistoryView({ history, onResetHistory }: AppHistoryViewProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? history.filter(
          (item) =>
            item.name.toLowerCase().includes(q) || item.publisher.toLowerCase().includes(q),
        )
      : history;
    return [...list].sort((a, b) => b.cpuTimeSeconds - a.cpuTimeSeconds);
  }, [history, query]);

  const maxCpu = Math.max(1, ...history.map((h) => h.cpuTimeSeconds));
  const totalNetworkGb = history.reduce((sum, h) => sum + h.networkMb, 0) / 1024;

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="px-6 pt-6 pb-4 border-b border-white/[0.06] flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
            App History
          </h2>
          <p className="text-xs text-zinc-400 mt-1 flex flex-wrap items-center gap-2 tabular-nums">
            <span>{history.length} tracked applications</span>
            <span aria-hidden="true">·</span>
            <span>{totalNetworkGb.toFixed(1)} GB cumulative network</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-60">
            <label htmlFor="history-search" className="sr-only">
              Filter app history
            </label>
            <Search
              className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="history-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter apps"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#1F1F24] border border-white/[0.09] text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#60CDFF] focus:ring-1 focus:ring-[#60CDFF]"
            />
          </div>

          <button
            type="button"
            onClick={onResetHistory}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1F1F24] hover:bg-white/[0.08] border border-white/[0.1] text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
            <span>Delete usage history</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="rounded-xl bg-[#1B1B1F]/80 backdrop-blur-xl border border-white/[0.08] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="border-b border-white/[0.07] bg-[#1F1F24]/90 text-[12px] font-medium text-zinc-400">
                  <th scope="col" className="py-3 pl-4 pr-3">
                    Application
                  </th>
                  <th scope="col" className="py-3 px-3">
                    Publisher
                  </th>
                  <th scope="col" className="py-3 px-3 text-right">
                    CPU time
                  </th>
                  <th scope="col" className="py-3 px-3 text-right">
                    Network
                  </th>
                  <th scope="col" className="py-3 px-3 text-right">
                    Metered network
                  </th>
                  <th scope="col" className="py-3 pl-3 pr-4 text-right">
                    Tile updates
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.045] text-[13px]">
                {filtered.map((entry) => {
                  const barPct = Math.round((entry.cpuTimeSeconds / maxCpu) * 100);
                  return (
                    <tr key={entry.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3 pl-4 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-md bg-white/[0.05] border border-white/[0.06] flex items-center justify-center shrink-0">
                            <ProcessIcon id={entry.id} className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-zinc-100">{entry.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-zinc-400">{entry.publisher}</td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex flex-col items-end gap-1 min-w-[96px]">
                          <span className="font-mono text-xs text-zinc-100 tabular-nums">
                            {formatCpuTime(entry.cpuTimeSeconds)}
                          </span>
                          <div className="w-24 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#60CDFF]/80"
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs text-zinc-200 tabular-nums">
                        {entry.networkMb >= 1024
                          ? `${(entry.networkMb / 1024).toFixed(1)} GB`
                          : `${entry.networkMb.toFixed(1)} MB`}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs text-zinc-400 tabular-nums">
                        {entry.meteredNetworkMb.toFixed(1)} MB
                      </td>
                      <td className="py-3 pl-3 pr-4 text-right font-mono text-xs text-zinc-300 tabular-nums">
                        {entry.tileUpdatesMb.toFixed(1)} MB
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
