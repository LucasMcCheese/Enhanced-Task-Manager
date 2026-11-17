import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Search,
  SlidersHorizontal,
  X,
  XOctagon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  filterProcesses,
  getResourceSeverity,
  PROCESS_PRIORITIES,
  sortProcesses,
  type HardwareTelemetry,
  type ProcessCategory,
  type ProcessInfo,
  type ProcessPriority,
  type ProcessSortField,
  type ResourceSeverity,
  type SortDirection,
} from '../services/systemService';
import { ProcessIcon } from './ProcessIcon';

interface ProcessesViewProps {
  processes: ProcessInfo[];
  telemetry: HardwareTelemetry;
  selectedProcessId: string | null;
  onSelectProcess: (id: string | null) => void;
  onEndTask: (process: ProcessInfo) => void;
  onSetPriority: (process: ProcessInfo, priority: ProcessPriority) => void;
}

const CATEGORY_FILTERS: { id: ProcessCategory | 'All'; label: string }[] = [
  { id: 'All', label: 'All' },
  { id: 'App', label: 'Apps' },
  { id: 'Background', label: 'Background' },
  { id: 'Windows', label: 'Windows' },
];

function getHeatCellClasses(severity: ResourceSeverity): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/18 text-red-200 font-semibold';
    case 'high':
      return 'bg-amber-500/15 text-amber-200 font-medium';
    default:
      return 'text-zinc-200';
  }
}

export function ProcessesView({
  processes,
  telemetry,
  selectedProcessId,
  onSelectProcess,
  onEndTask,
  onSetPriority,
}: ProcessesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ProcessCategory | 'All'>('All');
  const [sortField, setSortField] = useState<ProcessSortField>('cpu');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [endingIds, setEndingIds] = useState<Record<string, boolean>>({});

  const visibleProcesses = useMemo(() => {
    const filtered = filterProcesses(processes, searchQuery, categoryFilter);
    return sortProcesses(filtered, sortField, sortDirection);
  }, [processes, searchQuery, categoryFilter, sortField, sortDirection]);

  const selectedProcess = useMemo(
    () => processes.find((p) => p.id === selectedProcessId) ?? null,
    [processes, selectedProcessId],
  );

  const handleSort = (field: ProcessSortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'name' || field === 'status' ? 'asc' : 'desc');
    }
  };

  const handleEndSelected = (proc: ProcessInfo) => {
    setEndingIds((prev) => ({ ...prev, [proc.id]: true }));
    window.setTimeout(() => {
      onEndTask(proc);
      setEndingIds((prev) => {
        const next = { ...prev };
        delete next[proc.id];
        return next;
      });
    }, 170);
  };

  const renderSortIcon = (field: ProcessSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 opacity-60" aria-hidden="true" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-[#60CDFF]" aria-hidden="true" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-[#60CDFF]" aria-hidden="true" />
    );
  };

  const getHeaderAriaSort = (field: ProcessSortField) => {
    if (sortField !== field) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  const totalCpuColor =
    telemetry.cpu.utilization >= 75
      ? 'text-red-300'
      : telemetry.cpu.utilization >= 45
        ? 'text-amber-300'
        : 'text-zinc-100';

  const totalMemColor =
    telemetry.memory.utilization >= 85
      ? 'text-red-300'
      : telemetry.memory.utilization >= 65
        ? 'text-amber-300'
        : 'text-zinc-100';

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* Page Header & Filter Toolbar */}
      <header className="px-6 pt-6 pb-4 border-b border-white/[0.06] flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
              Processes
            </h2>
            <p className="text-xs text-zinc-400 mt-1 flex flex-wrap items-center gap-2 tabular-nums">
              <span>{processes.length} running</span>
              <span aria-hidden="true">·</span>
              <span className={totalCpuColor}>CPU {telemetry.cpu.utilization.toFixed(1)}%</span>
              <span aria-hidden="true">·</span>
              <span className={totalMemColor}>
                Memory {telemetry.memory.usedGb.toFixed(1)} / {telemetry.memory.totalGb.toFixed(0)} GB
              </span>
              <span aria-hidden="true">·</span>
              <span>Disk {telemetry.disk.activeTimePct.toFixed(0)}%</span>
              <span aria-hidden="true">·</span>
              <span>GPU {telemetry.gpu.utilization.toFixed(0)}%</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Box */}
            <div className="relative w-64 sm:w-72">
              <label htmlFor="process-search" className="sr-only">
                Search processes by name, executable, or PID
              </label>
              <Search
                className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="process-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type a name, publisher, or PID"
                className="w-full pl-9 pr-8 py-2 rounded-lg bg-[#1F1F24] border border-white/[0.09] text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#60CDFF] focus:ring-1 focus:ring-[#60CDFF] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear process search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-zinc-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Category Segmented Filter */}
            <div
              role="group"
              aria-label="Filter processes by category"
              className="flex items-center gap-1 p-1 rounded-lg bg-[#1C1C20] border border-white/[0.07]"
            >
              {CATEGORY_FILTERS.map((cat) => {
                const active = categoryFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    aria-pressed={active}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white/[0.11] text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* High-Density Process Table */}
      <div className="flex-1 overflow-auto px-6 py-4 pb-28">
        {visibleProcesses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 rounded-xl bg-[#1B1B1F]/70 border border-white/[0.07] text-center">
            <Search className="w-8 h-8 text-zinc-500 mb-3" aria-hidden="true" />
            <h3 className="font-display text-base font-semibold text-zinc-100">
              No matching processes
            </h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm">
              No active processes matched your current search or category filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('All');
              }}
              className="mt-4 px-4 py-2 rounded-lg bg-[#60CDFF] text-[#111315] text-xs font-semibold hover:bg-[#7AD6FF] transition-colors whitespace-nowrap"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="rounded-xl bg-[#1B1B1F]/80 backdrop-blur-xl border border-white/[0.08] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[780px]">
                <thead>
                  <tr className="border-b border-white/[0.07] bg-[#1F1F24]/90 text-[12px] font-medium text-zinc-400">
                    <th scope="col" aria-sort={getHeaderAriaSort('name')} className="py-2.5 pl-4 pr-3">
                      <button
                        type="button"
                        onClick={() => handleSort('name')}
                        className="inline-flex items-center gap-1.5 hover:text-zinc-100 transition-colors whitespace-nowrap"
                      >
                        <span>Name</span>
                        {renderSortIcon('name')}
                      </button>
                    </th>
                    <th scope="col" aria-sort={getHeaderAriaSort('status')} className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => handleSort('status')}
                        className="inline-flex items-center gap-1.5 hover:text-zinc-100 transition-colors whitespace-nowrap"
                      >
                        <span>Status</span>
                        {renderSortIcon('status')}
                      </button>
                    </th>
                    <th scope="col" aria-sort={getHeaderAriaSort('cpu')} className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('cpu')}
                        className="inline-flex items-center justify-end gap-1.5 hover:text-zinc-100 transition-colors whitespace-nowrap ml-auto"
                      >
                        <span>CPU</span>
                        {renderSortIcon('cpu')}
                      </button>
                    </th>
                    <th scope="col" aria-sort={getHeaderAriaSort('memoryMb')} className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('memoryMb')}
                        className="inline-flex items-center justify-end gap-1.5 hover:text-zinc-100 transition-colors whitespace-nowrap ml-auto"
                      >
                        <span>Memory</span>
                        {renderSortIcon('memoryMb')}
                      </button>
                    </th>
                    <th scope="col" aria-sort={getHeaderAriaSort('diskMbPerSec')} className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('diskMbPerSec')}
                        className="inline-flex items-center justify-end gap-1.5 hover:text-zinc-100 transition-colors whitespace-nowrap ml-auto"
                      >
                        <span>Disk</span>
                        {renderSortIcon('diskMbPerSec')}
                      </button>
                    </th>
                    <th scope="col" aria-sort={getHeaderAriaSort('gpu')} className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('gpu')}
                        className="inline-flex items-center justify-end gap-1.5 hover:text-zinc-100 transition-colors whitespace-nowrap ml-auto"
                      >
                        <span>GPU</span>
                        {renderSortIcon('gpu')}
                      </button>
                    </th>
                    <th scope="col" aria-sort={getHeaderAriaSort('priority')} className="py-2.5 pl-3 pr-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('priority')}
                        className="inline-flex items-center justify-end gap-1.5 hover:text-zinc-100 transition-colors whitespace-nowrap ml-auto"
                      >
                        <span>Priority</span>
                        {renderSortIcon('priority')}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.045] text-[13px]">
                  {visibleProcesses.map((proc) => {
                    const isSelected = proc.id === selectedProcessId;
                    const isEnding = Boolean(endingIds[proc.id]);
                    const cpuSeverity = getResourceSeverity('cpu', proc.cpu);
                    const memSeverity = getResourceSeverity('memoryMb', proc.memoryMb);
                    const diskSeverity = getResourceSeverity('diskMbPerSec', proc.diskMbPerSec);
                    const gpuSeverity = getResourceSeverity('gpu', proc.gpu);

                    return (
                      <tr
                        key={proc.id}
                        onClick={() => onSelectProcess(isSelected ? null : proc.id)}
                        data-selected={isSelected ? 'true' : 'false'}
                        className={`cursor-pointer transition-all duration-150 ${
                          isEnding ? 'opacity-0 -translate-x-4' : 'opacity-100 translate-x-0'
                        } ${
                          isSelected
                            ? 'bg-[#60CDFF]/14 hover:bg-[#60CDFF]/18 ring-1 ring-inset ring-[#60CDFF]/35'
                            : 'hover:bg-white/[0.04]'
                        }`}
                      >
                        <td className="py-2.5 pl-4 pr-3">
                          <button
                            type="button"
                            aria-pressed={isSelected}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectProcess(isSelected ? null : proc.id);
                            }}
                            className="flex items-center gap-3 text-left w-full rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60CDFF]"
                          >
                            <div className="w-7 h-7 rounded-md bg-white/[0.05] border border-white/[0.06] flex items-center justify-center shrink-0">
                              <ProcessIcon id={proc.id} className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-zinc-100 truncate">
                                {proc.name}
                              </div>
                              <div className="text-[11px] text-zinc-400 truncate flex items-center gap-1.5">
                                <span>{proc.executable}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">PID {proc.pid}</span>
                              </div>
                            </div>
                          </button>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-xs text-zinc-400">
                          {proc.status}
                        </td>
                        <td className="py-1.5 px-1.5 text-right">
                          <div
                            className={`px-2.5 py-1.5 rounded-md font-mono tabular-nums text-xs inline-flex items-center justify-end gap-1.5 min-w-[74px] ${getHeatCellClasses(cpuSeverity)}`}
                          >
                            {cpuSeverity !== 'normal' && (
                              <span className="sr-only">
                                {cpuSeverity === 'critical' ? 'Critical CPU usage' : 'High CPU usage'}
                              </span>
                            )}
                            <span>{proc.cpu.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-1.5 text-right">
                          <div
                            className={`px-2.5 py-1.5 rounded-md font-mono tabular-nums text-xs inline-flex items-center justify-end gap-1.5 min-w-[92px] ${getHeatCellClasses(memSeverity)}`}
                          >
                            {memSeverity !== 'normal' && (
                              <span className="sr-only">
                                {memSeverity === 'critical'
                                  ? 'Critical memory usage'
                                  : 'High memory usage'}
                              </span>
                            )}
                            <span>{proc.memoryMb.toLocaleString()} MB</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-1.5 text-right">
                          <div
                            className={`px-2.5 py-1.5 rounded-md font-mono tabular-nums text-xs inline-flex items-center justify-end gap-1.5 min-w-[84px] ${getHeatCellClasses(diskSeverity)}`}
                          >
                            <span>{proc.diskMbPerSec.toFixed(1)} MB/s</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-1.5 text-right">
                          <div
                            className={`px-2.5 py-1.5 rounded-md font-mono tabular-nums text-xs inline-flex items-center justify-end gap-1.5 min-w-[68px] ${getHeatCellClasses(gpuSeverity)}`}
                          >
                            <span>{proc.gpu.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap text-xs text-zinc-300">
                          {proc.priority}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Action Bar when a process is selected */}
      {selectedProcess && (
        <div
          role="region"
          aria-label="Selected process actions"
          className="fixed bottom-4 left-4 right-4 lg:left-[264px] xl:left-[280px] z-30 flex justify-center pointer-events-none"
        >
          <div className="pointer-events-auto w-full max-w-3xl px-4 py-3 rounded-2xl bg-[#222227]/92 backdrop-blur-2xl border border-white/[0.12] shadow-2xl flex flex-wrap items-center justify-between gap-3 animate-[barIn_180ms_cubic-bezier(0.16,1,0.3,1)]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
                <ProcessIcon id={selectedProcess.id} className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {selectedProcess.name}
                </p>
                <p className="text-xs text-zinc-400 truncate font-mono tabular-nums">
                  {selectedProcess.executable} · PID {selectedProcess.pid} ·{' '}
                  {selectedProcess.cpu.toFixed(1)}% CPU
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="process-priority-select"
                  className="text-xs text-zinc-300 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
                  <span>Set Priority</span>
                </label>
                <select
                  id="process-priority-select"
                  aria-label="Set Priority"
                  value={selectedProcess.priority}
                  onChange={(e) =>
                    onSetPriority(selectedProcess, e.target.value as ProcessPriority)
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-[#16161A] border border-white/[0.12] text-xs text-zinc-100 focus:outline-none focus:border-[#60CDFF] focus:ring-1 focus:ring-[#60CDFF]"
                >
                  {PROCESS_PRIORITIES.map((prio) => (
                    <option key={prio} value={prio}>
                      {prio}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => handleEndSelected(selectedProcess)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-500/90 hover:bg-red-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              >
                <XOctagon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>End Task</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectProcess(null)}
                aria-label="Clear process selection"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
