import { Cpu, HardDrive, Info, MemoryStick, Monitor, RotateCcw, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { HardwareProfile } from '../services/systemService';

interface HardwareProfileModalProps {
  profile: HardwareProfile;
  onSave: (nextProfile: HardwareProfile) => void;
  onResetToAutoDetected: () => void;
  onClose: () => void;
}

export function HardwareProfileModal({
  profile,
  onSave,
  onResetToAutoDetected,
  onClose,
}: HardwareProfileModalProps) {
  const [cpuModel, setCpuModel] = useState(profile.cpuModel);
  const [cores, setCores] = useState(String(profile.cores));
  const [logicalProcessors, setLogicalProcessors] = useState(String(profile.logicalProcessors));
  const [memoryTotalGb, setMemoryTotalGb] = useState(String(profile.memoryTotalGb));
  const [memorySpeedMhz, setMemorySpeedMhz] = useState(String(profile.memorySpeedMhz));
  const [diskModel, setDiskModel] = useState(profile.diskModel);
  const [diskCapacityGb, setDiskCapacityGb] = useState(String(profile.diskCapacityGb));
  const [gpuModel, setGpuModel] = useState(profile.gpuModel);
  const [gpuVramTotalGb, setGpuVramTotalGb] = useState(String(profile.gpuVramTotalGb));
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsedCores = Number.parseInt(cores, 10);
    const parsedThreads = Number.parseInt(logicalProcessors, 10);
    const parsedRam = Number.parseFloat(memoryTotalGb);
    const parsedRamSpeed = Number.parseInt(memorySpeedMhz, 10);
    const parsedDiskCap = Number.parseFloat(diskCapacityGb);
    const parsedVram = Number.parseFloat(gpuVramTotalGb);

    if (!cpuModel.trim() || !gpuModel.trim() || !diskModel.trim()) {
      setError('CPU, GPU, and Drive model names cannot be empty.');
      return;
    }
    if (
      !Number.isFinite(parsedCores) ||
      parsedCores < 1 ||
      !Number.isFinite(parsedThreads) ||
      parsedThreads < 1 ||
      !Number.isFinite(parsedRam) ||
      parsedRam < 2 ||
      !Number.isFinite(parsedRamSpeed) ||
      parsedRamSpeed < 800 ||
      !Number.isFinite(parsedDiskCap) ||
      parsedDiskCap < 64 ||
      !Number.isFinite(parsedVram) ||
      parsedVram < 1
    ) {
      setError('Enter valid positive hardware numbers (e.g., RAM ≥ 2 GB, Disk ≥ 64 GB).');
      return;
    }

    onSave({
      ...profile,
      cpuModel: cpuModel.trim(),
      cores: parsedCores,
      logicalProcessors: parsedThreads,
      memoryTotalGb: parsedRam,
      memorySpeedMhz: parsedRamSpeed,
      memoryFormFactor: 'DIMM',
      diskModel: diskModel.trim(),
      diskCapacityGb: parsedDiskCap,
      gpuModel: gpuModel.trim(),
      gpuVramTotalGb: parsedVram,
      source: 'custom',
    });
  };

  const hints = profile.detectedHints;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hw-modal-title"
    >
      <div className="w-full max-w-xl rounded-2xl bg-[#1E1E24] border border-white/[0.12] shadow-2xl overflow-hidden animate-[toastIn_180ms_cubic-bezier(0.16,1,0.3,1)]">
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between gap-4">
          <div>
            <h3 id="hw-modal-title" className="font-display text-base font-semibold text-white">
              Hardware Profile &amp; Specs
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Customize your machine specs or inspect what your browser sandbox exposes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close hardware specs dialog"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          {/* Browser Sandbox Transparency Callout */}
          <div className="p-3.5 rounded-xl bg-[#16161B] border border-white/[0.08] flex items-start gap-3">
            <Info className="w-4 h-4 text-[#60CDFF] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs text-zinc-300 leading-relaxed">
              <p className="font-medium text-zinc-100">
                Why browsers can&apos;t read full PC specs automatically
              </p>
              <p className="text-zinc-400 mt-1">
                Web browsers expose your GPU renderer and logical thread count, while hiding exact CPU model names, RAM above 8 GB, and disk serials for privacy. Edit below to match your PC, or connect a local Windows WMI/ETW service in{' '}
                <code className="font-mono text-zinc-200">systemService.ts</code>.
              </p>
              {hints && (
                <p className="text-[11px] font-mono text-zinc-400 mt-2 tabular-nums">
                  Detected: {hints.logicalProcessors ?? '?'} threads ·{' '}
                  {hints.gpuRenderer ?? 'WebGL unavailable'} ·{' '}
                  {hints.deviceMemoryGb !== null
                    ? `${hints.deviceMemoryGb} GB (browser cap)`
                    : 'RAM hidden'}
                </p>
              )}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="px-3.5 py-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-xs text-red-200"
            >
              {error}
            </div>
          )}

          {/* CPU Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8">
              <label
                htmlFor="hw-cpu-model"
                className="text-xs font-medium text-zinc-300 flex items-center gap-1.5 mb-1.5"
              >
                <Cpu className="w-3.5 h-3.5 text-[#60CDFF]" aria-hidden="true" />
                <span>CPU Model</span>
              </label>
              <input
                id="hw-cpu-model"
                type="text"
                value={cpuModel}
                onChange={(e) => setCpuModel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#141418] border border-white/[0.1] text-xs text-zinc-100 focus:outline-none focus:border-[#60CDFF] focus:ring-1 focus:ring-[#60CDFF]"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="hw-cores" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Cores
              </label>
              <input
                id="hw-cores"
                type="number"
                min={1}
                value={cores}
                onChange={(e) => setCores(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#141418] border border-white/[0.1] text-xs font-mono text-zinc-100 focus:outline-none focus:border-[#60CDFF]"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="hw-threads" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Threads
              </label>
              <input
                id="hw-threads"
                type="number"
                min={1}
                value={logicalProcessors}
                onChange={(e) => setLogicalProcessors(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#141418] border border-white/[0.1] text-xs font-mono text-zinc-100 focus:outline-none focus:border-[#60CDFF]"
              />
            </div>
          </div>

          {/* Memory Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="hw-ram-gb"
                className="text-xs font-medium text-zinc-300 flex items-center gap-1.5 mb-1.5"
              >
                <MemoryStick className="w-3.5 h-3.5 text-violet-400" aria-hidden="true" />
                <span>Total RAM (GB)</span>
              </label>
              <input
                id="hw-ram-gb"
                type="number"
                min={2}
                step="1"
                value={memoryTotalGb}
                onChange={(e) => setMemoryTotalGb(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#141418] border border-white/[0.1] text-xs font-mono text-zinc-100 focus:outline-none focus:border-[#60CDFF]"
              />
            </div>
            <div>
              <label htmlFor="hw-ram-speed" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Memory Speed (MT/s)
              </label>
              <input
                id="hw-ram-speed"
                type="number"
                min={800}
                step="100"
                value={memorySpeedMhz}
                onChange={(e) => setMemorySpeedMhz(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#141418] border border-white/[0.1] text-xs font-mono text-zinc-100 focus:outline-none focus:border-[#60CDFF]"
              />
            </div>
          </div>

          {/* GPU Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-9">
              <label
                htmlFor="hw-gpu-model"
                className="text-xs font-medium text-zinc-300 flex items-center gap-1.5 mb-1.5"
              >
                <Monitor className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                <span>GPU Model</span>
              </label>
              <input
                id="hw-gpu-model"
                type="text"
                value={gpuModel}
                onChange={(e) => setGpuModel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#141418] border border-white/[0.1] text-xs text-zinc-100 focus:outline-none focus:border-[#60CDFF]"
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="hw-gpu-vram" className="block text-xs font-medium text-zinc-300 mb-1.5">
                VRAM (GB)
              </label>
              <input
                id="hw-gpu-vram"
                type="number"
                min={1}
                step="1"
                value={gpuVramTotalGb}
                onChange={(e) => setGpuVramTotalGb(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#141418] border border-white/[0.1] text-xs font-mono text-zinc-100 focus:outline-none focus:border-[#60CDFF]"
              />
            </div>
          </div>

          {/* Disk Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-9">
              <label
                htmlFor="hw-disk-model"
                className="text-xs font-medium text-zinc-300 flex items-center gap-1.5 mb-1.5"
              >
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <span>Primary Drive Model</span>
              </label>
              <input
                id="hw-disk-model"
                type="text"
                value={diskModel}
                onChange={(e) => setDiskModel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#141418] border border-white/[0.1] text-xs text-zinc-100 focus:outline-none focus:border-[#60CDFF]"
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="hw-disk-cap" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Size (GB)
              </label>
              <input
                id="hw-disk-cap"
                type="number"
                min={64}
                step="1"
                value={diskCapacityGb}
                onChange={(e) => setDiskCapacityGb(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#141418] border border-white/[0.1] text-xs font-mono text-zinc-100 focus:outline-none focus:border-[#60CDFF]"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onResetToAutoDetected}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-xs font-medium text-zinc-300 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Re-detect from browser</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:bg-white/[0.06] transition-colors whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#60CDFF] hover:bg-[#7AD6FF] text-[#111315] text-xs font-semibold transition-colors whitespace-nowrap"
              >
                Save specs
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
