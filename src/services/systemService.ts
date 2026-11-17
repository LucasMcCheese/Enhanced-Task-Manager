/**
 * systemService.ts
 *
 * Clean abstraction layer for Windows 11 Task Manager telemetry.
 * Swap `MockWindowsSystemService` with a real Windows API implementation
 * (e.g., Tauri/Electron IPC, local Rust/C# ETW + WMI bridge over WebSocket/REST)
 * by implementing `ISystemService` and replacing `createSystemService()`.
 */

export type TabId =
  | 'processes'
  | 'performance'
  | 'app-history'
  | 'startup-apps'
  | 'storage-analyzer';

export type ProcessPriority =
  | 'Realtime'
  | 'High'
  | 'Above Normal'
  | 'Normal'
  | 'Below Normal'
  | 'Low';

export type ProcessCategory = 'App' | 'Background' | 'Windows';

export type ResourceSeverity = 'normal' | 'high' | 'critical';

export interface ProcessInfo {
  id: string;
  pid: number;
  name: string;
  executable: string;
  publisher: string;
  category: ProcessCategory;
  status: 'Running' | 'Efficiency mode';
  cpu: number; // Percentage 0 - 100
  memoryMb: number; // MB
  diskMbPerSec: number; // MB/s
  gpu: number; // Percentage 0 - 100
  priority: ProcessPriority;
  threads: number;
}

export type ProcessSortField =
  | 'name'
  | 'status'
  | 'cpu'
  | 'memoryMb'
  | 'diskMbPerSec'
  | 'gpu'
  | 'priority';

export type SortDirection = 'asc' | 'desc';

export type PerformanceMetricKey = 'cpu' | 'memory' | 'disk' | 'gpu';

export interface HardwareTelemetry {
  uptimeSeconds: number;
  cpu: {
    model: string;
    utilization: number;
    speedGhz: number;
    baseSpeedGhz: number;
    sockets: number;
    cores: number;
    logicalProcessors: number;
    l1CacheKb: number;
    l2CacheMb: number;
    l3CacheMb: number;
    virtualization: string;
    temperatureC: number;
    handles: number;
    threads: number;
    history: number[];
  };
  memory: {
    specLabel: string;
    totalGb: number;
    usedGb: number;
    availableGb: number;
    committedGb: number;
    committedLimitGb: number;
    cachedGb: number;
    pagedPoolMb: number;
    nonPagedPoolMb: number;
    speedMhz: number;
    slotsUsed: string;
    formFactor: string;
    utilization: number;
    history: number[];
  };
  disk: {
    model: string;
    driveLetter: string;
    capacityGb: number;
    activeTimePct: number;
    readMbPerSec: number;
    writeMbPerSec: number;
    avgResponseMs: number;
    formattedGb: number;
    systemDisk: boolean;
    type: string;
    history: number[];
  };
  gpu: {
    model: string;
    driverVersion: string;
    directXVersion: string;
    utilization: number;
    dedicatedVramUsedGb: number;
    dedicatedVramTotalGb: number;
    sharedVramUsedGb: number;
    sharedVramTotalGb: number;
    temperatureC: number;
    clockMhz: number;
    history: number[];
  };
}

export interface AppHistoryEntry {
  id: string;
  name: string;
  publisher: string;
  cpuTimeSeconds: number;
  networkMb: number;
  meteredNetworkMb: number;
  tileUpdatesMb: number;
}

export type BootImpact = 'High' | 'Medium' | 'Low';

export interface StartupAppEntry {
  id: string;
  name: string;
  publisher: string;
  executable: string;
  enabled: boolean;
  impact: BootImpact;
  lastBootSeconds: number;
}

export type StorageCategory = 'Apps' | 'Games' | 'System' | 'Media' | 'Temp';

export interface StorageFolder {
  id: string;
  name: string;
  path: string;
  sizeGb: number;
  fileCount: number;
  category: StorageCategory;
  children: {
    name: string;
    sizeGb: number;
    files: number;
  }[];
}

export interface StorageDrive {
  id: string;
  letter: string;
  label: string;
  fileSystem: string;
  totalGb: number;
  usedGb: number;
  folders: StorageFolder[];
}

export interface HardwareProfile {
  cpuModel: string;
  cores: number;
  logicalProcessors: number;
  memoryTotalGb: number;
  memorySpeedMhz: number;
  memoryFormFactor: string;
  diskModel: string;
  diskType: string;
  diskCapacityGb: number;
  gpuModel: string;
  gpuVramTotalGb: number;
  source: 'auto-detected' | 'custom';
  detectedHints?: {
    logicalProcessors: number | null;
    deviceMemoryGb: number | null;
    gpuRenderer: string | null;
    platform: string | null;
  };
}

export interface SystemSnapshot {
  processes: ProcessInfo[];
  telemetry: HardwareTelemetry;
  appHistory: AppHistoryEntry[];
  startupApps: StartupAppEntry[];
  storageDrives: StorageDrive[];
  hardwareProfile: HardwareProfile;
}

export interface ISystemService {
  getInitialSnapshot(): SystemSnapshot;
  tick(currentProcesses: ProcessInfo[], currentTelemetry: HardwareTelemetry): {
    processes: ProcessInfo[];
    telemetry: HardwareTelemetry;
  };
  endProcess(processes: ProcessInfo[], processId: string): ProcessInfo[];
  setProcessPriority(
    processes: ProcessInfo[],
    processId: string,
    priority: ProcessPriority,
  ): ProcessInfo[];
  toggleStartupApp(apps: StartupAppEntry[], appId: string): StartupAppEntry[];
  resetAppHistory(history: AppHistoryEntry[]): AppHistoryEntry[];
}

export const PRIORITY_ORDER: Record<ProcessPriority, number> = {
  Realtime: 6,
  High: 5,
  'Above Normal': 4,
  Normal: 3,
  'Below Normal': 2,
  Low: 1,
};

export const PROCESS_PRIORITIES: ProcessPriority[] = [
  'Realtime',
  'High',
  'Above Normal',
  'Normal',
  'Below Normal',
  'Low',
];

export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export function roundTo(val: number, decimals = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/**
 * Classifies resource metrics into normal, high (amber), or critical (red).
 */
export function getResourceSeverity(
  metric: 'cpu' | 'memoryMb' | 'diskMbPerSec' | 'gpu',
  value: number,
): ResourceSeverity {
  switch (metric) {
    case 'cpu':
      if (value >= 25) return 'critical';
      if (value >= 10) return 'high';
      return 'normal';
    case 'memoryMb':
      if (value >= 2200) return 'critical';
      if (value >= 950) return 'high';
      return 'normal';
    case 'diskMbPerSec':
      if (value >= 45) return 'critical';
      if (value >= 12) return 'high';
      return 'normal';
    case 'gpu':
      if (value >= 30) return 'critical';
      if (value >= 12) return 'high';
      return 'normal';
  }
}

export function filterProcesses(
  processes: ProcessInfo[],
  searchQuery: string,
  category: ProcessCategory | 'All' = 'All',
): ProcessInfo[] {
  const q = searchQuery.trim().toLowerCase();
  return processes.filter((proc) => {
    if (category !== 'All' && proc.category !== category) {
      return false;
    }
    if (!q) return true;
    return (
      proc.name.toLowerCase().includes(q) ||
      proc.executable.toLowerCase().includes(q) ||
      proc.publisher.toLowerCase().includes(q) ||
      String(proc.pid).includes(q)
    );
  });
}

export function sortProcesses(
  processes: ProcessInfo[],
  field: ProcessSortField,
  direction: SortDirection,
): ProcessInfo[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...processes].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'status':
        cmp = a.status.localeCompare(b.status);
        break;
      case 'cpu':
        cmp = a.cpu - b.cpu;
        break;
      case 'memoryMb':
        cmp = a.memoryMb - b.memoryMb;
        break;
      case 'diskMbPerSec':
        cmp = a.diskMbPerSec - b.diskMbPerSec;
        break;
      case 'gpu':
        cmp = a.gpu - b.gpu;
        break;
      case 'priority':
        cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        break;
    }
    if (cmp === 0) {
      return a.name.localeCompare(b.name);
    }
    return cmp * multiplier;
  });
}

export function formatUptime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${days}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatCpuTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatStorageSize(gb: number): string {
  if (gb < 1) {
    return `${Math.round(gb * 1024)} MB`;
  }
  return `${gb.toFixed(1)} GB`;
}

interface ProcessVolatilityProfile {
  cpuBase: number;
  cpuSwing: number;
  memBase: number;
  memSwing: number;
  diskBase: number;
  diskSwing: number;
  gpuBase: number;
  gpuSwing: number;
}

const VOLATILITY_PROFILES: Record<string, ProcessVolatilityProfile> = {
  'chrome': {
    cpuBase: 14.5,
    cpuSwing: 9.0,
    memBase: 2640,
    memSwing: 160,
    diskBase: 2.4,
    diskSwing: 3.1,
    gpuBase: 8.2,
    gpuSwing: 5.5,
  },
  'steam-game': {
    cpuBase: 27.8,
    cpuSwing: 11.5,
    memBase: 3120,
    memSwing: 120,
    diskBase: 18.4,
    diskSwing: 28.0,
    gpuBase: 46.5,
    gpuSwing: 16.0,
  },
  'docker': {
    cpuBase: 11.4,
    cpuSwing: 6.2,
    memBase: 1890,
    memSwing: 90,
    diskBase: 14.2,
    diskSwing: 15.0,
    gpuBase: 0.2,
    gpuSwing: 0.4,
  },
  'vscode': {
    cpuBase: 6.4,
    cpuSwing: 4.8,
    memBase: 1240,
    memSwing: 65,
    diskBase: 1.8,
    diskSwing: 2.4,
    gpuBase: 2.4,
    gpuSwing: 1.8,
  },
  'discord': {
    cpuBase: 4.2,
    cpuSwing: 3.1,
    memBase: 580,
    memSwing: 35,
    diskBase: 0.4,
    diskSwing: 0.9,
    gpuBase: 3.1,
    gpuSwing: 2.2,
  },
  'spotify': {
    cpuBase: 1.8,
    cpuSwing: 1.4,
    memBase: 345,
    memSwing: 20,
    diskBase: 0.6,
    diskSwing: 1.2,
    gpuBase: 1.2,
    gpuSwing: 0.9,
  },
  'obsidian': {
    cpuBase: 0.9,
    cpuSwing: 0.8,
    memBase: 260,
    memSwing: 14,
    diskBase: 0.2,
    diskSwing: 0.5,
    gpuBase: 0.5,
    gpuSwing: 0.4,
  },
  'explorer': {
    cpuBase: 1.6,
    cpuSwing: 1.2,
    memBase: 196,
    memSwing: 12,
    diskBase: 0.7,
    diskSwing: 1.4,
    gpuBase: 2.8,
    gpuSwing: 1.5,
  },
  'dwm': {
    cpuBase: 3.4,
    cpuSwing: 1.9,
    memBase: 215,
    memSwing: 18,
    diskBase: 0.1,
    diskSwing: 0.2,
    gpuBase: 13.8,
    gpuSwing: 5.5,
  },
  'defender': {
    cpuBase: 5.1,
    cpuSwing: 5.5,
    memBase: 410,
    memSwing: 28,
    diskBase: 22.5,
    diskSwing: 26.0,
    gpuBase: 0,
    gpuSwing: 0,
  },
  'system': {
    cpuBase: 1.4,
    cpuSwing: 1.1,
    memBase: 128,
    memSwing: 6,
    diskBase: 3.2,
    diskSwing: 4.5,
    gpuBase: 0.4,
    gpuSwing: 0.5,
  },
  'nvidia': {
    cpuBase: 0.7,
    cpuSwing: 0.6,
    memBase: 142,
    memSwing: 8,
    diskBase: 0.1,
    diskSwing: 0.2,
    gpuBase: 2.1,
    gpuSwing: 1.4,
  },
  'search': {
    cpuBase: 0.8,
    cpuSwing: 1.2,
    memBase: 164,
    memSwing: 10,
    diskBase: 4.1,
    diskSwing: 6.2,
    gpuBase: 0,
    gpuSwing: 0,
  },
  'audio': {
    cpuBase: 0.5,
    cpuSwing: 0.4,
    memBase: 64,
    memSwing: 4,
    diskBase: 0,
    diskSwing: 0.1,
    gpuBase: 0,
    gpuSwing: 0,
  },
};

export function tickProcesses(
  processes: ProcessInfo[],
  rng: () => number = Math.random,
): ProcessInfo[] {
  return processes.map((proc) => {
    const profile = VOLATILITY_PROFILES[proc.id] ?? {
      cpuBase: proc.cpu,
      cpuSwing: 1.5,
      memBase: proc.memoryMb,
      memSwing: 15,
      diskBase: proc.diskMbPerSec,
      diskSwing: 1.0,
      gpuBase: proc.gpu,
      gpuSwing: 1.0,
    };

    const priorityFactor =
      proc.priority === 'High' || proc.priority === 'Realtime'
        ? 1.12
        : proc.priority === 'Low' || proc.priority === 'Below Normal'
          ? 0.85
          : 1;

    const jitter = () => (rng() - 0.48) * 2;
    const nextCpu = clamp(
      proc.cpu * 0.55 + (profile.cpuBase * priorityFactor + jitter() * profile.cpuSwing) * 0.45,
      0.1,
      98.5,
    );
    const nextMem = clamp(
      proc.memoryMb * 0.7 + (profile.memBase + jitter() * profile.memSwing) * 0.3,
      24,
      16384,
    );
    const nextDisk = clamp(
      proc.diskMbPerSec * 0.5 + (profile.diskBase + jitter() * profile.diskSwing) * 0.5,
      0,
      450,
    );
    const nextGpu =
      profile.gpuBase === 0 && profile.gpuSwing === 0
        ? 0
        : clamp(
            proc.gpu * 0.55 + (profile.gpuBase + jitter() * profile.gpuSwing) * 0.45,
            0,
            99,
          );

    return {
      ...proc,
      cpu: roundTo(nextCpu, 1),
      memoryMb: Math.round(nextMem),
      diskMbPerSec: roundTo(nextDisk, 1),
      gpu: roundTo(nextGpu, 1),
    };
  });
}

export function tickHardwareTelemetry(
  prev: HardwareTelemetry,
  processes: ProcessInfo[],
  rng: () => number = Math.random,
): HardwareTelemetry {
  const totalProcCpu = processes.reduce((sum, p) => sum + p.cpu, 0);
  const totalProcMemGb = processes.reduce((sum, p) => sum + p.memoryMb, 0) / 1024;
  const totalProcDisk = processes.reduce((sum, p) => sum + p.diskMbPerSec, 0);
  const totalProcGpu = processes.reduce((sum, p) => sum + p.gpu, 0);

  const cpuUtil = roundTo(clamp(totalProcCpu * 0.72 + (rng() - 0.5) * 3.5, 4, 98), 1);
  const cpuSpeed = roundTo(
    clamp(3.9 + (cpuUtil / 100) * 1.65 + (rng() - 0.5) * 0.18, 3.6, 5.7),
    2,
  );
  const cpuTemp = Math.round(clamp(42 + cpuUtil * 0.42 + (rng() - 0.5) * 2, 38, 89));

  const memFloor = Math.min(2.4, prev.memory.totalGb * 0.3);
  const memCap = Math.max(memFloor + 0.5, prev.memory.totalGb - Math.max(0.8, prev.memory.totalGb * 0.05));
  const memScaled = Math.min(totalProcMemGb + prev.memory.totalGb * 0.14, prev.memory.totalGb * 0.85);
  const memUsed = roundTo(clamp(memScaled, memFloor, memCap), 1);
  const memAvail = roundTo(Math.max(0, prev.memory.totalGb - memUsed), 1);
  const memUtil = roundTo((memUsed / Math.max(1, prev.memory.totalGb)) * 100, 1);

  const diskRead = roundTo(clamp(totalProcDisk * 0.65 + rng() * 6, 0.2, 520), 1);
  const diskWrite = roundTo(clamp(totalProcDisk * 0.35 + rng() * 4, 0.1, 340), 1);
  const diskActive = roundTo(clamp((diskRead + diskWrite) * 0.42 + (rng() - 0.3) * 4, 1, 98), 1);
  const diskResp = roundTo(clamp(0.3 + diskActive * 0.045, 0.2, 14.5), 1);

  const gpuUtil = roundTo(clamp(totalProcGpu * 0.76 + (rng() - 0.5) * 3, 2, 99), 1);
  const maxVram = Math.max(2, prev.gpu.dedicatedVramTotalGb);
  const gpuVram = roundTo(clamp(maxVram * 0.14 + (gpuUtil / 100) * (maxVram * 0.55), 0.5, maxVram * 0.94), 1);
  const gpuTemp = Math.round(clamp(39 + gpuUtil * 0.34 + (rng() - 0.5) * 1.5, 36, 82));
  const gpuClock = Math.round(clamp(1650 + (gpuUtil / 100) * 885, 1200, 2610));

  const pushHistory = (arr: number[], next: number) => [...arr.slice(1), next];

  return {
    uptimeSeconds: prev.uptimeSeconds + 1,
    cpu: {
      ...prev.cpu,
      utilization: cpuUtil,
      speedGhz: cpuSpeed,
      temperatureC: cpuTemp,
      threads: processes.reduce((s, p) => s + p.threads, 2400),
      handles: 94200 + processes.length * 1420 + Math.round((rng() - 0.5) * 320),
      history: pushHistory(prev.cpu.history, cpuUtil),
    },
    memory: {
      ...prev.memory,
      usedGb: memUsed,
      availableGb: memAvail,
      committedGb: roundTo(memUsed + Math.min(3.8, prev.memory.totalGb * 0.15), 1),
      utilization: memUtil,
      history: pushHistory(prev.memory.history, memUtil),
    },
    disk: {
      ...prev.disk,
      activeTimePct: diskActive,
      readMbPerSec: diskRead,
      writeMbPerSec: diskWrite,
      avgResponseMs: diskResp,
      history: pushHistory(prev.disk.history, diskActive),
    },
    gpu: {
      ...prev.gpu,
      utilization: gpuUtil,
      dedicatedVramUsedGb: gpuVram,
      temperatureC: gpuTemp,
      clockMhz: gpuClock,
      history: pushHistory(prev.gpu.history, gpuUtil),
    },
  };
}

const HARDWARE_PROFILE_STORAGE_KEY = 'win11_task_manager_hardware_profile_v1';

/**
 * Normalizes WebGL UNMASKED_RENDERER_WEBGL strings (e.g. Chromium ANGLE wrappers)
 * into clean GPU display names.
 */
export function parseWebGlRenderer(rawRenderer: string): string {
  const trimmed = rawRenderer.trim();
  if (!trimmed) return 'Integrated Graphics Adapter';

  // ANGLE (Vendor, Device (0x...) Direct3D11 vs_5_0 ps_5_0, D3D11)
  const angleMatch = trimmed.match(/^ANGLE\s*\((.*)\)$/i);
  if (angleMatch) {
    const parts = angleMatch[1].split(',').map((s) => s.trim());
    const body = parts.length >= 2 ? parts.slice(1).join(', ') : parts[0];
    if (/swiftshader/i.test(body)) {
      return 'Google SwiftShader (Software WebGL)';
    }
    const cleaned = body
      .replace(/^ANGLE Metal Renderer:\s*/i, '')
      .replace(/\s*\(0x[0-9a-f]+\)/gi, '')
      .replace(/\s*Direct3D\d+.*$/i, '')
      .replace(/\s*vs_\d+_\d+.*$/i, '')
      .replace(/\s*OpenGL.*$/i, '')
      .replace(/,\s*Unspecified Version$/i, '')
      .replace(/,\s*D3D\d+$/i, '')
      .trim();
    if (cleaned) return cleaned;
  }

  return trimmed;
}

export function detectBrowserHardware(): HardwareProfile {
  const hasNav = typeof navigator !== 'undefined';
  const logicalProcessors =
    hasNav && typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency > 0
      ? navigator.hardwareConcurrency
      : 16;

  const estimatedCores =
    logicalProcessors >= 4 && logicalProcessors % 2 === 0
      ? Math.max(2, Math.round(logicalProcessors / 2))
      : logicalProcessors;

  const rawDeviceMemory =
    hasNav && 'deviceMemory' in navigator && typeof (navigator as { deviceMemory?: unknown }).deviceMemory === 'number'
      ? (navigator as { deviceMemory: number }).deviceMemory
      : null;

  // Browsers cap navigator.deviceMemory at 8 GB for fingerprinting protection
  const memoryTotalGb = rawDeviceMemory !== null ? rawDeviceMemory : 16;

  const platform =
    hasNav
      ? (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ||
        navigator.platform ||
        null
      : null;

  let detectedGpu: string | null = null;
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) {
          const raw = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
          if (typeof raw === 'string' && raw.trim()) {
            detectedGpu = parseWebGlRenderer(raw);
          }
        }
      }
    } catch {
      // Ignore WebGL context restrictions
    }
  }

  const cpuLabel = platform
    ? `${platform} Processor (${logicalProcessors} logical processors detected)`
    : `System Processor (${logicalProcessors} logical processors detected)`;

  return {
    cpuModel: cpuLabel,
    cores: estimatedCores,
    logicalProcessors,
    memoryTotalGb,
    memorySpeedMhz: 4800,
    memoryFormFactor: rawDeviceMemory !== null ? 'Browser-reported (capped at 8 GB)' : 'DIMM',
    diskModel: 'Primary System Drive (Sandbox)',
    diskType: 'NVMe SSD',
    diskCapacityGb: 1000,
    gpuModel: detectedGpu ?? 'System GPU Adapter',
    gpuVramTotalGb: 8,
    source: 'auto-detected',
    detectedHints: {
      logicalProcessors: hasNav ? logicalProcessors : null,
      deviceMemoryGb: rawDeviceMemory,
      gpuRenderer: detectedGpu,
      platform,
    },
  };
}

export function loadHardwareProfile(): HardwareProfile | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(HARDWARE_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HardwareProfile>;
    if (
      typeof parsed.cpuModel === 'string' &&
      typeof parsed.gpuModel === 'string' &&
      typeof parsed.memoryTotalGb === 'number' &&
      parsed.memoryTotalGb > 0
    ) {
      const detected = detectBrowserHardware();
      return {
        ...detected,
        ...parsed,
        source: 'custom',
        detectedHints: detected.detectedHints,
      };
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

export function saveHardwareProfile(profile: HardwareProfile): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(HARDWARE_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage errors
  }
}

export function clearHardwareProfile(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(HARDWARE_PROFILE_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function applyHardwareProfile(
  telemetry: HardwareTelemetry,
  drives: StorageDrive[],
  profile: HardwareProfile,
): { telemetry: HardwareTelemetry; drives: StorageDrive[] } {
  const safeMemTotal = Math.max(2, profile.memoryTotalGb);
  const safeUsedGb = roundTo(clamp(telemetry.memory.usedGb, Math.min(1.5, safeMemTotal * 0.25), safeMemTotal * 0.88), 1);
  const safeAvailGb = roundTo(Math.max(0, safeMemTotal - safeUsedGb), 1);
  const safeMemUtil = roundTo((safeUsedGb / safeMemTotal) * 100, 1);

  const safeDiskCap = Math.max(64, profile.diskCapacityGb);
  const safeVramTotal = Math.max(1, profile.gpuVramTotalGb);
  const safeVramUsed = roundTo(clamp(telemetry.gpu.dedicatedVramUsedGb, 0.5, safeVramTotal * 0.9), 1);

  const nextTelemetry: HardwareTelemetry = {
    ...telemetry,
    cpu: {
      ...telemetry.cpu,
      model: profile.cpuModel,
      cores: Math.max(1, profile.cores),
      logicalProcessors: Math.max(1, profile.logicalProcessors),
    },
    memory: {
      ...telemetry.memory,
      specLabel: `${safeMemTotal.toFixed(1)} GB (${profile.memorySpeedMhz} MT/s)`,
      totalGb: safeMemTotal,
      usedGb: safeUsedGb,
      availableGb: safeAvailGb,
      committedLimitGb: roundTo(safeMemTotal * 1.15, 1),
      speedMhz: profile.memorySpeedMhz,
      formFactor: profile.memoryFormFactor,
      utilization: safeMemUtil,
    },
    disk: {
      ...telemetry.disk,
      model: profile.diskModel,
      type: profile.diskType,
      capacityGb: safeDiskCap,
      formattedGb: safeDiskCap,
    },
    gpu: {
      ...telemetry.gpu,
      model: profile.gpuModel,
      dedicatedVramTotalGb: safeVramTotal,
      dedicatedVramUsedGb: safeVramUsed,
      sharedVramTotalGb: roundTo(safeMemTotal / 2, 1),
    },
  };

  const nextDrives = drives.map((d, idx) => {
    if (idx !== 0) return d;
    const ratio = d.usedGb / Math.max(1, d.totalGb);
    const nextUsed = roundTo(clamp(safeDiskCap * ratio, 10, safeDiskCap * 0.94), 1);
    return {
      ...d,
      label: profile.diskModel,
      totalGb: safeDiskCap,
      usedGb: nextUsed,
    };
  });

  return { telemetry: nextTelemetry, drives: nextDrives };
}

function generateInitialSeries(base: number, variance: number, length = 60): number[] {
  const series: number[] = [];
  let cursor = base;
  for (let i = 0; i < length; i++) {
    const wave = Math.sin(i * 0.32) * (variance * 0.45);
    const step = ((i * 17) % 11 - 5) * (variance * 0.08);
    cursor = roundTo(clamp(base + wave + step, 2, 95), 1);
    series.push(cursor);
  }
  return series;
}

const INITIAL_PROCESSES: ProcessInfo[] = [
  {
    id: 'steam-game',
    pid: 14820,
    name: 'Steam Client & Overlay',
    executable: 'steamwebhelper.exe',
    publisher: 'Valve Corporation',
    category: 'App',
    status: 'Running',
    cpu: 26.4,
    memoryMb: 3120,
    diskMbPerSec: 18.4,
    gpu: 44.2,
    priority: 'High',
    threads: 68,
  },
  {
    id: 'chrome',
    pid: 8912,
    name: 'Google Chrome (14 tabs)',
    executable: 'chrome.exe',
    publisher: 'Google LLC',
    category: 'App',
    status: 'Running',
    cpu: 14.8,
    memoryMb: 2640,
    diskMbPerSec: 2.4,
    gpu: 8.6,
    priority: 'Normal',
    threads: 94,
  },
  {
    id: 'docker',
    pid: 5416,
    name: 'Docker Desktop Backend',
    executable: 'com.docker.backend.exe',
    publisher: 'Docker Inc.',
    category: 'Background',
    status: 'Running',
    cpu: 11.2,
    memoryMb: 1890,
    diskMbPerSec: 14.2,
    gpu: 0.2,
    priority: 'Normal',
    threads: 52,
  },
  {
    id: 'vscode',
    pid: 11204,
    name: 'Visual Studio Code',
    executable: 'Code.exe',
    publisher: 'Microsoft Corporation',
    category: 'App',
    status: 'Running',
    cpu: 6.4,
    memoryMb: 1240,
    diskMbPerSec: 1.8,
    gpu: 2.4,
    priority: 'Normal',
    threads: 48,
  },
  {
    id: 'defender',
    pid: 3180,
    name: 'Antimalware Service Executable',
    executable: 'MsMpEng.exe',
    publisher: 'Microsoft Corporation',
    category: 'Windows',
    status: 'Running',
    cpu: 5.1,
    memoryMb: 410,
    diskMbPerSec: 22.5,
    gpu: 0,
    priority: 'Below Normal',
    threads: 31,
  },
  {
    id: 'discord',
    pid: 10344,
    name: 'Discord',
    executable: 'Discord.exe',
    publisher: 'Discord Inc.',
    category: 'App',
    status: 'Running',
    cpu: 4.2,
    memoryMb: 580,
    diskMbPerSec: 0.4,
    gpu: 3.1,
    priority: 'Normal',
    threads: 39,
  },
  {
    id: 'dwm',
    pid: 1624,
    name: 'Desktop Window Manager',
    executable: 'dwm.exe',
    publisher: 'Microsoft Corporation',
    category: 'Windows',
    status: 'Running',
    cpu: 3.4,
    memoryMb: 215,
    diskMbPerSec: 0.1,
    gpu: 13.8,
    priority: 'High',
    threads: 22,
  },
  {
    id: 'spotify',
    pid: 9402,
    name: 'Spotify',
    executable: 'Spotify.exe',
    publisher: 'Spotify AB',
    category: 'App',
    status: 'Efficiency mode',
    cpu: 1.8,
    memoryMb: 345,
    diskMbPerSec: 0.6,
    gpu: 1.2,
    priority: 'Normal',
    threads: 27,
  },
  {
    id: 'explorer',
    pid: 4792,
    name: 'Windows Explorer',
    executable: 'Explorer.exe',
    publisher: 'Microsoft Corporation',
    category: 'Windows',
    status: 'Running',
    cpu: 1.6,
    memoryMb: 196,
    diskMbPerSec: 0.7,
    gpu: 2.8,
    priority: 'Normal',
    threads: 44,
  },
  {
    id: 'system',
    pid: 4,
    name: 'System',
    executable: 'ntoskrnl.exe',
    publisher: 'Microsoft Corporation',
    category: 'Windows',
    status: 'Running',
    cpu: 1.4,
    memoryMb: 128,
    diskMbPerSec: 3.2,
    gpu: 0.4,
    priority: 'Realtime',
    threads: 186,
  },
  {
    id: 'obsidian',
    pid: 12880,
    name: 'Obsidian',
    executable: 'Obsidian.exe',
    publisher: 'Dynalist Inc.',
    category: 'App',
    status: 'Efficiency mode',
    cpu: 0.9,
    memoryMb: 260,
    diskMbPerSec: 0.2,
    gpu: 0.5,
    priority: 'Normal',
    threads: 19,
  },
  {
    id: 'search',
    pid: 4108,
    name: 'Windows Search Indexer',
    executable: 'SearchIndexer.exe',
    publisher: 'Microsoft Corporation',
    category: 'Windows',
    status: 'Efficiency mode',
    cpu: 0.8,
    memoryMb: 164,
    diskMbPerSec: 4.1,
    gpu: 0,
    priority: 'Low',
    threads: 16,
  },
  {
    id: 'nvidia',
    pid: 2940,
    name: 'NVIDIA Container',
    executable: 'NVDisplay.Container.exe',
    publisher: 'NVIDIA Corporation',
    category: 'Background',
    status: 'Running',
    cpu: 0.7,
    memoryMb: 142,
    diskMbPerSec: 0.1,
    gpu: 2.1,
    priority: 'Normal',
    threads: 14,
  },
  {
    id: 'audio',
    pid: 3748,
    name: 'Windows Audio Device Graph',
    executable: 'audiodg.exe',
    publisher: 'Microsoft Corporation',
    category: 'Windows',
    status: 'Running',
    cpu: 0.5,
    memoryMb: 64,
    diskMbPerSec: 0,
    gpu: 0,
    priority: 'Above Normal',
    threads: 9,
  },
];

const INITIAL_TELEMETRY: HardwareTelemetry = {
  uptimeSeconds: 3 * 86400 + 14 * 3600 + 27 * 60 + 42,
  cpu: {
    model: 'AMD Ryzen 9 7950X 16-Core Processor',
    utilization: 48.2,
    speedGhz: 5.14,
    baseSpeedGhz: 4.5,
    sockets: 1,
    cores: 16,
    logicalProcessors: 32,
    l1CacheKb: 1024,
    l2CacheMb: 16,
    l3CacheMb: 64,
    virtualization: 'Enabled',
    temperatureC: 62,
    handles: 114080,
    threads: 3069,
    history: generateInitialSeries(46, 16, 60),
  },
  memory: {
    specLabel: '32.0 GB DDR5-6000',
    totalGb: 32.0,
    usedGb: 15.6,
    availableGb: 16.4,
    committedGb: 19.4,
    committedLimitGb: 36.8,
    cachedGb: 9.8,
    pagedPoolMb: 684,
    nonPagedPoolMb: 412,
    speedMhz: 6000,
    slotsUsed: '2 of 4',
    formFactor: 'DIMM',
    utilization: 48.8,
    history: generateInitialSeries(48, 6, 60),
  },
  disk: {
    model: 'Samsung SSD 990 PRO 2TB',
    driveLetter: 'C:',
    capacityGb: 1863,
    activeTimePct: 24.5,
    readMbPerSec: 46.2,
    writeMbPerSec: 21.8,
    avgResponseMs: 1.4,
    formattedGb: 1863,
    systemDisk: true,
    type: 'NVMe PCIe 4.0',
    history: generateInitialSeries(24, 18, 60),
  },
  gpu: {
    model: 'NVIDIA GeForce RTX 4080',
    driverVersion: '566.14',
    directXVersion: '12 (FL 12.2)',
    utilization: 56.4,
    dedicatedVramUsedGb: 7.1,
    dedicatedVramTotalGb: 16.0,
    sharedVramUsedGb: 0.4,
    sharedVramTotalGb: 16.0,
    temperatureC: 58,
    clockMhz: 2210,
    history: generateInitialSeries(54, 18, 60),
  },
};

const INITIAL_APP_HISTORY: AppHistoryEntry[] = [
  {
    id: 'hist-chrome',
    name: 'Google Chrome',
    publisher: 'Google LLC',
    cpuTimeSeconds: 18420,
    networkMb: 14280.4,
    meteredNetworkMb: 0,
    tileUpdatesMb: 12.4,
  },
  {
    id: 'hist-steam',
    name: 'Steam',
    publisher: 'Valve Corporation',
    cpuTimeSeconds: 26140,
    networkMb: 48620.8,
    meteredNetworkMb: 0,
    tileUpdatesMb: 4.1,
  },
  {
    id: 'hist-vscode',
    name: 'Visual Studio Code',
    publisher: 'Microsoft Corporation',
    cpuTimeSeconds: 9830,
    networkMb: 1240.2,
    meteredNetworkMb: 0,
    tileUpdatesMb: 0.8,
  },
  {
    id: 'hist-discord',
    name: 'Discord',
    publisher: 'Discord Inc.',
    cpuTimeSeconds: 6145,
    networkMb: 3890.6,
    meteredNetworkMb: 0,
    tileUpdatesMb: 6.2,
  },
  {
    id: 'hist-spotify',
    name: 'Spotify',
    publisher: 'Spotify AB',
    cpuTimeSeconds: 3290,
    networkMb: 2410.0,
    meteredNetworkMb: 0,
    tileUpdatesMb: 1.5,
  },
  {
    id: 'hist-edge',
    name: 'Microsoft Edge',
    publisher: 'Microsoft Corporation',
    cpuTimeSeconds: 1940,
    networkMb: 860.3,
    meteredNetworkMb: 0,
    tileUpdatesMb: 3.9,
  },
  {
    id: 'hist-teams',
    name: 'Microsoft Teams',
    publisher: 'Microsoft Corporation',
    cpuTimeSeconds: 4510,
    networkMb: 5120.7,
    meteredNetworkMb: 0,
    tileUpdatesMb: 2.1,
  },
  {
    id: 'hist-store',
    name: 'Microsoft Store',
    publisher: 'Microsoft Corporation',
    cpuTimeSeconds: 420,
    networkMb: 1940.5,
    meteredNetworkMb: 0,
    tileUpdatesMb: 18.6,
  },
];

const INITIAL_STARTUP_APPS: StartupAppEntry[] = [
  {
    id: 'su-docker',
    name: 'Docker Desktop',
    publisher: 'Docker Inc.',
    executable: 'Docker Desktop.exe',
    enabled: true,
    impact: 'High',
    lastBootSeconds: 4.8,
  },
  {
    id: 'su-steam',
    name: 'Steam',
    publisher: 'Valve Corporation',
    executable: 'steam.exe',
    enabled: true,
    impact: 'High',
    lastBootSeconds: 3.9,
  },
  {
    id: 'su-discord',
    name: 'Discord',
    publisher: 'Discord Inc.',
    executable: 'Update.exe',
    enabled: true,
    impact: 'Medium',
    lastBootSeconds: 2.1,
  },
  {
    id: 'su-spotify',
    name: 'Spotify',
    publisher: 'Spotify AB',
    executable: 'Spotify.exe',
    enabled: false,
    impact: 'Medium',
    lastBootSeconds: 1.7,
  },
  {
    id: 'su-onedrive',
    name: 'Microsoft OneDrive',
    publisher: 'Microsoft Corporation',
    executable: 'OneDrive.exe',
    enabled: true,
    impact: 'Medium',
    lastBootSeconds: 1.9,
  },
  {
    id: 'su-security',
    name: 'Windows Security Notification',
    publisher: 'Microsoft Corporation',
    executable: 'SecurityHealthSystray.exe',
    enabled: true,
    impact: 'Low',
    lastBootSeconds: 0.4,
  },
  {
    id: 'su-powertoys',
    name: 'Microsoft PowerToys',
    publisher: 'Microsoft Corporation',
    executable: 'PowerToys.exe',
    enabled: true,
    impact: 'Low',
    lastBootSeconds: 0.7,
  },
  {
    id: 'su-epic',
    name: 'Epic Games Launcher',
    publisher: 'Epic Games, Inc.',
    executable: 'EpicGamesLauncher.exe',
    enabled: false,
    impact: 'High',
    lastBootSeconds: 3.4,
  },
  {
    id: 'su-logi',
    name: 'Logi Options+',
    publisher: 'Logitech Inc.',
    executable: 'logioptionsplus_agent.exe',
    enabled: true,
    impact: 'Low',
    lastBootSeconds: 0.6,
  },
];

const INITIAL_STORAGE_DRIVES: StorageDrive[] = [
  {
    id: 'drive-c',
    letter: 'C:',
    label: 'Windows NVMe (System)',
    fileSystem: 'NTFS',
    totalGb: 1863,
    usedGb: 1284.6,
    folders: [
      {
        id: 'c-steam',
        name: 'SteamLibrary',
        path: 'C:\\Program Files (x86)\\Steam\\steamapps',
        sizeGb: 468.4,
        fileCount: 142890,
        category: 'Games',
        children: [
          { name: 'Cyberpunk 2077', sizeGb: 112.4, files: 18420 },
          { name: 'Baldur\'s Gate 3', sizeGb: 144.8, files: 34110 },
          { name: 'Elden Ring', sizeGb: 68.2, files: 12040 },
          { name: 'Shader Cache & Workshop', sizeGb: 143.0, files: 78320 },
        ],
      },
      {
        id: 'c-users',
        name: 'Users\\DevWorkstation',
        path: 'C:\\Users\\DevWorkstation',
        sizeGb: 312.8,
        fileCount: 289400,
        category: 'Apps',
        children: [
          { name: 'AppData\\Local\\Docker', sizeGb: 128.4, files: 91200 },
          { name: 'Projects\\Monorepos', sizeGb: 86.2, files: 148200 },
          { name: 'Downloads', sizeGb: 58.6, files: 1420 },
          { name: 'AppData\\Local\\Temp & Caches', sizeGb: 39.6, files: 48580 },
        ],
      },
      {
        id: 'c-program-files',
        name: 'Program Files',
        path: 'C:\\Program Files',
        sizeGb: 214.2,
        fileCount: 94210,
        category: 'Apps',
        children: [
          { name: 'Adobe Creative Cloud', sizeGb: 64.8, files: 31400 },
          { name: 'Microsoft Visual Studio', sizeGb: 52.4, files: 28900 },
          { name: 'Docker & WSL', sizeGb: 48.0, files: 12410 },
          { name: 'NVIDIA & Drivers', sizeGb: 49.0, files: 21500 },
        ],
      },
      {
        id: 'c-windows',
        name: 'Windows',
        path: 'C:\\Windows',
        sizeGb: 146.5,
        fileCount: 210450,
        category: 'System',
        children: [
          { name: 'WinSxS (Component Store)', sizeGb: 62.4, files: 118400 },
          { name: 'System32 & SysWOW64', sizeGb: 48.2, files: 64200 },
          { name: 'SoftwareDistribution', sizeGb: 21.6, files: 18250 },
          { name: 'Logs & Hibernation', sizeGb: 14.3, files: 9600 },
        ],
      },
      {
        id: 'c-media',
        name: 'Captures & Renders',
        path: 'C:\\Users\\DevWorkstation\\Videos',
        sizeGb: 94.3,
        fileCount: 1840,
        category: 'Media',
        children: [
          { name: 'ShadowPlay 4K Clips', sizeGb: 56.2, files: 420 },
          { name: 'DaVinci Resolve Cache', sizeGb: 28.4, files: 1180 },
          { name: 'Screenshots', sizeGb: 9.7, files: 240 },
        ],
      },
      {
        id: 'c-temp',
        name: 'Windows.old & Temp',
        path: 'C:\\Windows\\Temp',
        sizeGb: 48.4,
        fileCount: 18900,
        category: 'Temp',
        children: [
          { name: 'Windows Update Cleanup', sizeGb: 29.2, files: 8400 },
          { name: 'Delivery Optimization Files', sizeGb: 12.8, files: 6200 },
          { name: 'Crash Dumps', sizeGb: 6.4, files: 4300 },
        ],
      },
    ],
  },
  {
    id: 'drive-d',
    letter: 'D:',
    label: 'Archive & Scratch SSD',
    fileSystem: 'NTFS',
    totalGb: 3726,
    usedGb: 1490.2,
    folders: [
      {
        id: 'd-vms',
        name: 'Virtual Machines',
        path: 'D:\\HyperV\\VMs',
        sizeGb: 612.0,
        fileCount: 148,
        category: 'Apps',
        children: [
          { name: 'Ubuntu-24.04-Build.vhdx', sizeGb: 248.0, files: 4 },
          { name: 'Windows-11-Sandbox.vhdx', sizeGb: 196.0, files: 6 },
          { name: 'K8s-Cluster-Nodes', sizeGb: 168.0, files: 138 },
        ],
      },
      {
        id: 'd-media',
        name: 'RAW Photography & 4K Footage',
        path: 'D:\\MediaArchive',
        sizeGb: 542.4,
        fileCount: 42810,
        category: 'Media',
        children: [
          { name: '2026 Raw Stills', sizeGb: 284.2, files: 38200 },
          { name: 'ProRes Master Exports', sizeGb: 258.2, files: 4610 },
        ],
      },
      {
        id: 'd-games',
        name: 'GamesVault',
        path: 'D:\\GamesVault',
        sizeGb: 335.8,
        fileCount: 81400,
        category: 'Games',
        children: [
          { name: 'Flight Simulator Assets', sizeGb: 214.6, files: 52100 },
          { name: 'Epic & GOG Library', sizeGb: 121.2, files: 29300 },
        ],
      },
    ],
  },
];

export class MockWindowsSystemService implements ISystemService {
  getInitialSnapshot(): SystemSnapshot {
    const hardwareProfile = loadHardwareProfile() ?? detectBrowserHardware();
    const baseTelemetry: HardwareTelemetry = {
      ...INITIAL_TELEMETRY,
      cpu: { ...INITIAL_TELEMETRY.cpu, history: [...INITIAL_TELEMETRY.cpu.history] },
      memory: { ...INITIAL_TELEMETRY.memory, history: [...INITIAL_TELEMETRY.memory.history] },
      disk: { ...INITIAL_TELEMETRY.disk, history: [...INITIAL_TELEMETRY.disk.history] },
      gpu: { ...INITIAL_TELEMETRY.gpu, history: [...INITIAL_TELEMETRY.gpu.history] },
    };
    const baseDrives: StorageDrive[] = INITIAL_STORAGE_DRIVES.map((d) => ({
      ...d,
      folders: d.folders.map((f) => ({
        ...f,
        children: f.children.map((c) => ({ ...c })),
      })),
    }));

    const applied = applyHardwareProfile(baseTelemetry, baseDrives, hardwareProfile);

    return {
      processes: INITIAL_PROCESSES.map((p) => ({ ...p })),
      telemetry: applied.telemetry,
      appHistory: INITIAL_APP_HISTORY.map((a) => ({ ...a })),
      startupApps: INITIAL_STARTUP_APPS.map((s) => ({ ...s })),
      storageDrives: applied.drives,
      hardwareProfile,
    };
  }

  tick(currentProcesses: ProcessInfo[], currentTelemetry: HardwareTelemetry) {
    const nextProcesses = tickProcesses(currentProcesses);
    const nextTelemetry = tickHardwareTelemetry(currentTelemetry, nextProcesses);
    return {
      processes: nextProcesses,
      telemetry: nextTelemetry,
    };
  }

  endProcess(processes: ProcessInfo[], processId: string): ProcessInfo[] {
    return processes.filter((p) => p.id !== processId);
  }

  setProcessPriority(
    processes: ProcessInfo[],
    processId: string,
    priority: ProcessPriority,
  ): ProcessInfo[] {
    return processes.map((p) => (p.id === processId ? { ...p, priority } : p));
  }

  toggleStartupApp(apps: StartupAppEntry[], appId: string): StartupAppEntry[] {
    return apps.map((app) =>
      app.id === appId ? { ...app, enabled: !app.enabled } : app,
    );
  }

  resetAppHistory(history: AppHistoryEntry[]): AppHistoryEntry[] {
    return history.map((entry) => ({
      ...entry,
      cpuTimeSeconds: 0,
      networkMb: 0,
      meteredNetworkMb: 0,
      tileUpdatesMb: 0,
    }));
  }
}

export function createSystemService(): ISystemService {
  return new MockWindowsSystemService();
}

export interface WindowsRuntimeStatus {
  isWindowsHost: boolean;
  platform: string;
  arch: string;
  hostname: string;
  runtime: 'electron-exe' | 'node-web' | 'browser-only';
  error: string | null;
  message: string;
}

export class WindowsApiError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code = 'WINDOWS_TELEMETRY_ERROR', statusCode = 500) {
    super(message);
    this.name = 'WindowsApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export async function fetchWindowsRuntimeStatus(): Promise<WindowsRuntimeStatus> {
  try {
    const res = await fetch('/api/windows/status', { cache: 'no-store' });
    if (!res.ok) {
      throw new WindowsApiError(
        `Windows status endpoint returned HTTP ${res.status}`,
        'STATUS_ENDPOINT_ERROR',
        res.status,
      );
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        isWindowsHost: false,
        platform: 'browser',
        arch: 'unknown',
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'web',
        runtime: 'browser-only',
        error: 'WINDOWS_HOST_REQUIRED',
        message:
          'Windows detection failed: static web environment cannot reach the local Windows native backend. Run the code version locally on Windows or package it as an .exe.',
      };
    }
    return (await res.json()) as WindowsRuntimeStatus;
  } catch (err) {
    if (err instanceof WindowsApiError) throw err;
    return {
      isWindowsHost: false,
      platform: 'browser',
      arch: 'unknown',
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'web',
      runtime: 'browser-only',
      error: 'WINDOWS_HOST_REQUIRED',
      message:
        'Windows detection failed: native local Windows backend is unreachable in the web browser. Run the code version locally on Windows or build the .exe.',
    };
  }
}

export async function fetchWindowsSnapshot(): Promise<SystemSnapshot> {
  const res = await fetch('/api/windows/snapshot', { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new WindowsApiError(
      data.message || `Failed to read Windows snapshot (HTTP ${res.status})`,
      data.error || 'WINDOWS_TELEMETRY_FAILED',
      res.status,
    );
  }
  return data as SystemSnapshot;
}

export async function endWindowsProcess(pid: number): Promise<void> {
  const res = await fetch('/api/windows/process/end', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pid }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new WindowsApiError(
      data.message || `Failed to end PID ${pid}`,
      data.error || 'END_PROCESS_FAILED',
      res.status,
    );
  }
}

export async function setWindowsProcessPriority(
  pid: number,
  priority: ProcessPriority,
): Promise<void> {
  const res = await fetch('/api/windows/process/priority', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pid, priority }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new WindowsApiError(
      data.message || `Failed to update priority for PID ${pid}`,
      data.error || 'SET_PRIORITY_FAILED',
      res.status,
    );
  }
}

export async function toggleWindowsStartupApp(name: string, enabled: boolean): Promise<void> {
  const res = await fetch('/api/windows/startup/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, enabled }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new WindowsApiError(
      data.message || `Failed to toggle startup app ${name}`,
      data.error || 'TOGGLE_STARTUP_FAILED',
      res.status,
    );
  }
}
