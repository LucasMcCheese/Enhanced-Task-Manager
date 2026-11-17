import { Cpu, HardDrive, MemoryStick, Monitor, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import {
  formatUptime,
  type HardwareProfile,
  type HardwareTelemetry,
  type PerformanceMetricKey,
} from '../services/systemService';
import { AreaSparkChart } from './AreaSparkChart';

interface PerformanceViewProps {
  telemetry: HardwareTelemetry;
  processCount: number;
  hardwareProfile: HardwareProfile;
  onOpenSpecsModal: () => void;
  isNativeWindows?: boolean;
}

const SUBSYSTEM_META: Record<
  PerformanceMetricKey,
  { label: string; color: string; icon: typeof Cpu }
> = {
  cpu: { label: 'CPU', color: '#60CDFF', icon: Cpu },
  memory: { label: 'Memory', color: '#A78BFA', icon: MemoryStick },
  disk: { label: 'Disk 0 (C:)', color: '#34D399', icon: HardDrive },
  gpu: { label: 'GPU 0', color: '#F59E0B', icon: Monitor },
};

export function PerformanceView({
  telemetry,
  processCount,
  hardwareProfile,
  onOpenSpecsModal,
  isNativeWindows = false,
}: PerformanceViewProps) {
  const [activeMetric, setActiveMetric] = useState<PerformanceMetricKey>('cpu');

  const cards: {
    key: PerformanceMetricKey;
    title: string;
    subtitle: string;
    primaryStat: string;
    history: number[];
  }[] = [
    {
      key: 'cpu',
      title: 'CPU',
      subtitle: `${telemetry.cpu.speedGhz.toFixed(2)} GHz · ${telemetry.cpu.temperatureC}°C`,
      primaryStat: `${telemetry.cpu.utilization.toFixed(0)}%`,
      history: telemetry.cpu.history,
    },
    {
      key: 'memory',
      title: 'Memory',
      subtitle: `${telemetry.memory.usedGb.toFixed(1)} / ${telemetry.memory.totalGb.toFixed(0)} GB`,
      primaryStat: `${telemetry.memory.utilization.toFixed(0)}%`,
      history: telemetry.memory.history,
    },
    {
      key: 'disk',
      title: `Disk 0 (${telemetry.disk.driveLetter})`,
      subtitle: `${telemetry.disk.type}`,
      primaryStat: `${telemetry.disk.activeTimePct.toFixed(0)}%`,
      history: telemetry.disk.history,
    },
    {
      key: 'gpu',
      title: 'GPU 0',
      subtitle: `${telemetry.gpu.dedicatedVramUsedGb.toFixed(1)} / ${telemetry.gpu.dedicatedVramTotalGb.toFixed(0)} GB VRAM`,
      primaryStat: `${telemetry.gpu.utilization.toFixed(0)}%`,
      history: telemetry.gpu.history,
    },
  ];

  const meta = SUBSYSTEM_META[activeMetric];

  const detailTitle =
    activeMetric === 'cpu'
      ? 'CPU'
      : activeMetric === 'memory'
        ? 'Memory'
        : activeMetric === 'disk'
          ? `Disk 0 (${telemetry.disk.driveLetter})`
          : 'GPU 0';

  const detailModel =
    activeMetric === 'cpu'
      ? telemetry.cpu.model
      : activeMetric === 'memory'
        ? telemetry.memory.specLabel
        : activeMetric === 'disk'
          ? telemetry.disk.model
          : telemetry.gpu.model;

  const detailHistory =
    activeMetric === 'cpu'
      ? telemetry.cpu.history
      : activeMetric === 'memory'
        ? telemetry.memory.history
        : activeMetric === 'disk'
          ? telemetry.disk.history
          : telemetry.gpu.history;

  const detailPrimaryReading =
    activeMetric === 'cpu'
      ? `${telemetry.cpu.utilization.toFixed(1)}%`
      : activeMetric === 'memory'
        ? `${telemetry.memory.usedGb.toFixed(1)} GB`
        : activeMetric === 'disk'
          ? `${telemetry.disk.activeTimePct.toFixed(1)}%`
          : `${telemetry.gpu.utilization.toFixed(1)}%`;

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="px-6 pt-6 pb-4 border-b border-white/[0.06] flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
            Performance
          </h2>
          <p className="text-xs text-zinc-400 mt-1 flex flex-wrap items-center gap-2">
            <span>{telemetry.cpu.model}</span>
            <span aria-hidden="true">·</span>
            <span>{telemetry.memory.specLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{telemetry.gpu.model}</span>
            <span aria-hidden="true">·</span>
            <span className={isNativeWindows ? 'text-emerald-300' : 'text-zinc-300'}>
              {isNativeWindows
                ? 'Windows CIM/WMI Live'
                : hardwareProfile.source === 'custom'
                  ? 'Custom specs'
                  : 'Browser-detected'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!isNativeWindows && (
            <button
              type="button"
              onClick={onOpenSpecsModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1F1F24] hover:bg-white/[0.08] border border-white/[0.1] text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60CDFF]"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#60CDFF]" aria-hidden="true" />
              <span>Edit specs</span>
            </button>
          )}

          <div className="px-3.5 py-2 rounded-lg bg-[#1B1B1F] border border-white/[0.08] flex items-center gap-3">
            <span className="text-xs text-zinc-400">System up time</span>
            <span
              data-testid="uptime-counter"
              className="font-mono text-sm font-semibold text-zinc-100 tabular-nums"
            >
              {formatUptime(telemetry.uptimeSeconds)}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* Left Subsystem Selector Cards */}
          <div className="xl:col-span-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
            {cards.map((card) => {
              const cardMeta = SUBSYSTEM_META[card.key];
              const Icon = cardMeta.icon;
              const isActive = activeMetric === card.key;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => setActiveMetric(card.key)}
                  aria-pressed={isActive}
                  className={`text-left p-3.5 rounded-xl border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60CDFF] ${
                    isActive
                      ? 'bg-[#222228] border-[#60CDFF]/50'
                      : 'bg-[#1B1B1F]/80 border-white/[0.07] hover:bg-[#202026] hover:border-white/[0.14]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className="w-4 h-4 shrink-0"
                        style={{ color: cardMeta.color }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zinc-100 truncate">
                          {card.title}
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate font-mono tabular-nums">
                          {card.subtitle}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-sm font-semibold text-white tabular-nums shrink-0">
                      {card.primaryStat}
                    </span>
                  </div>
                  <div className="rounded-md overflow-hidden bg-[#141416]/70 border border-white/[0.05] px-1 pt-1">
                    <AreaSparkChart
                      data={card.history}
                      color={cardMeta.color}
                      height={46}
                      showGrid={false}
                      interactive={false}
                      label={card.title}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Main Chart + Hardware Specs */}
          <div className="xl:col-span-8 flex flex-col gap-5">
            <section
              aria-label={`${detailTitle} live utilization`}
              className="p-5 rounded-xl bg-[#1B1B1F]/85 backdrop-blur-xl border border-white/[0.08]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-display text-xl font-semibold text-white">{detailTitle}</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">{detailModel}</p>
                </div>
                <div className="text-right">
                  <div
                    className="font-mono text-2xl font-semibold tabular-nums"
                    style={{ color: meta.color }}
                  >
                    {detailPrimaryReading}
                  </div>
                  <div className="text-[11px] text-zinc-400">60-second rolling window</div>
                </div>
              </div>

              <div className="rounded-lg bg-[#141416]/90 border border-white/[0.06] p-3">
                <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono mb-1 tabular-nums">
                  <span>% Utilization</span>
                  <span>100%</span>
                </div>
                <AreaSparkChart
                  data={detailHistory}
                  color={meta.color}
                  height={230}
                  showGrid={true}
                  interactive={true}
                  label={detailTitle}
                />
                <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono mt-1 tabular-nums">
                  <span>60 seconds</span>
                  <span>0</span>
                </div>
              </div>
            </section>

            {/* Detailed Hardware Specification Grid */}
            <section
              aria-label={`${detailTitle} hardware specifications`}
              className="p-5 rounded-xl bg-[#1B1B1F]/85 border border-white/[0.08]"
            >
              <h4 className="font-display text-sm font-semibold text-zinc-100 mb-4">
                Hardware telemetry & specifications
              </h4>

              {activeMetric === 'cpu' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
                  <SpecItem label="Utilization" value={`${telemetry.cpu.utilization.toFixed(1)}%`} />
                  <SpecItem label="Speed" value={`${telemetry.cpu.speedGhz.toFixed(2)} GHz`} />
                  <SpecItem label="Base speed" value={`${telemetry.cpu.baseSpeedGhz.toFixed(2)} GHz`} />
                  <SpecItem label="Temperature" value={`${telemetry.cpu.temperatureC} °C`} />
                  <SpecItem label="Processes" value={String(processCount)} />
                  <SpecItem label="Threads" value={telemetry.cpu.threads.toLocaleString()} />
                  <SpecItem label="Handles" value={telemetry.cpu.handles.toLocaleString()} />
                  <SpecItem label="Up time" value={formatUptime(telemetry.uptimeSeconds)} />
                  <SpecItem label="Cores" value={String(telemetry.cpu.cores)} />
                  <SpecItem
                    label="Logical processors"
                    value={String(telemetry.cpu.logicalProcessors)}
                  />
                  <SpecItem label="L2 / L3 cache" value={`${telemetry.cpu.l2CacheMb} MB / ${telemetry.cpu.l3CacheMb} MB`} />
                  <SpecItem label="Virtualization" value={telemetry.cpu.virtualization} />
                </div>
              )}

              {activeMetric === 'memory' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
                  <SpecItem label="In use" value={`${telemetry.memory.usedGb.toFixed(1)} GB`} />
                  <SpecItem label="Available" value={`${telemetry.memory.availableGb.toFixed(1)} GB`} />
                  <SpecItem
                    label="Committed"
                    value={`${telemetry.memory.committedGb.toFixed(1)} / ${telemetry.memory.committedLimitGb.toFixed(1)} GB`}
                  />
                  <SpecItem label="Cached" value={`${telemetry.memory.cachedGb.toFixed(1)} GB`} />
                  <SpecItem label="Paged pool" value={`${telemetry.memory.pagedPoolMb} MB`} />
                  <SpecItem label="Non-paged pool" value={`${telemetry.memory.nonPagedPoolMb} MB`} />
                  <SpecItem label="Speed" value={`${telemetry.memory.speedMhz} MT/s`} />
                  <SpecItem label="Slots used" value={telemetry.memory.slotsUsed} />
                </div>
              )}

              {activeMetric === 'disk' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
                  <SpecItem label="Active time" value={`${telemetry.disk.activeTimePct.toFixed(1)}%`} />
                  <SpecItem label="Read speed" value={`${telemetry.disk.readMbPerSec.toFixed(1)} MB/s`} />
                  <SpecItem label="Write speed" value={`${telemetry.disk.writeMbPerSec.toFixed(1)} MB/s`} />
                  <SpecItem label="Avg. response" value={`${telemetry.disk.avgResponseMs.toFixed(1)} ms`} />
                  <SpecItem label="Capacity" value={`${telemetry.disk.capacityGb} GB`} />
                  <SpecItem label="Formatted" value={`${telemetry.disk.formattedGb} GB`} />
                  <SpecItem label="System disk" value={telemetry.disk.systemDisk ? 'Yes' : 'No'} />
                  <SpecItem label="Interface" value={telemetry.disk.type} />
                </div>
              )}

              {activeMetric === 'gpu' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
                  <SpecItem label="Utilization" value={`${telemetry.gpu.utilization.toFixed(1)}%`} />
                  <SpecItem
                    label="Dedicated VRAM"
                    value={`${telemetry.gpu.dedicatedVramUsedGb.toFixed(1)} / ${telemetry.gpu.dedicatedVramTotalGb.toFixed(0)} GB`}
                  />
                  <SpecItem
                    label="Shared GPU memory"
                    value={`${telemetry.gpu.sharedVramUsedGb.toFixed(1)} / ${telemetry.gpu.sharedVramTotalGb.toFixed(0)} GB`}
                  />
                  <SpecItem label="Temperature" value={`${telemetry.gpu.temperatureC} °C`} />
                  <SpecItem label="Core clock" value={`${telemetry.gpu.clockMhz} MHz`} />
                  <SpecItem label="Driver version" value={telemetry.gpu.driverVersion} />
                  <SpecItem label="DirectX version" value={telemetry.gpu.directXVersion} />
                  <SpecItem label="Up time" value={formatUptime(telemetry.uptimeSeconds)} />
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-white/[0.06] pt-2.5">
      <dt className="text-[11px] text-zinc-400">{label}</dt>
      <dd className="font-mono text-sm font-semibold text-zinc-100 mt-0.5 tabular-nums">
        {value}
      </dd>
    </div>
  );
}
