import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  AppHistoryEntry,
  HardwareProfile,
  HardwareTelemetry,
  ProcessInfo,
  ProcessPriority,
  StartupAppEntry,
  StorageDrive,
  StorageFolder,
  SystemSnapshot,
} from '../src/services/systemService.ts';

const execFileAsync = promisify(execFile);

export class WindowsHostRequiredError extends Error {
  readonly code = 'WINDOWS_HOST_REQUIRED';
  readonly platform: string;

  constructor(platform: string) {
    super(
      `Native Windows detection failed: host platform is "${platform}". Run this code locally on Windows or package it as an .exe to access real Windows WMI/CIM and process APIs.`,
    );
    this.name = 'WindowsHostRequiredError';
    this.platform = platform;
  }
}

export function isWindowsPlatform(platform: string = process.platform): boolean {
  return platform === 'win32';
}

export function mapUiPriorityToWindows(
  priority: ProcessPriority,
): 'Idle' | 'BelowNormal' | 'Normal' | 'AboveNormal' | 'High' | 'RealTime' {
  switch (priority) {
    case 'Low':
      return 'Idle';
    case 'Below Normal':
      return 'BelowNormal';
    case 'Normal':
      return 'Normal';
    case 'Above Normal':
      return 'AboveNormal';
    case 'High':
      return 'High';
    case 'Realtime':
      return 'RealTime';
  }
}

export function mapWindowsPriorityToUi(raw: string | number | null | undefined): ProcessPriority {
  if (typeof raw === 'number') {
    if (raw >= 24) return 'Realtime';
    if (raw >= 13) return 'High';
    if (raw >= 10) return 'Above Normal';
    if (raw >= 8) return 'Normal';
    if (raw >= 6) return 'Below Normal';
    return 'Low';
  }
  const normalized = String(raw ?? 'Normal')
    .replace(/\s+/g, '')
    .toLowerCase();
  if (normalized === 'realtime') return 'Realtime';
  if (normalized === 'high') return 'High';
  if (normalized === 'abovenormal') return 'Above Normal';
  if (normalized === 'belownormal') return 'Below Normal';
  if (normalized === 'idle' || normalized === 'low') return 'Low';
  return 'Normal';
}

export function parsePowerShellJson<T>(stdout: string): T {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error('Empty PowerShell JSON output');
  }
  return JSON.parse(trimmed) as T;
}

function asArray<T>(val: T | T[] | null | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

async function runPowerShell(script: string, timeoutMs = 12000): Promise<string> {
  if (!isWindowsPlatform()) {
    throw new WindowsHostRequiredError(process.platform);
  }
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    },
  );
  return stdout;
}

export interface RawWmiSystemPayload {
  cpu?: {
    Name?: string;
    NumberOfCores?: number;
    NumberOfLogicalProcessors?: number;
    MaxClockSpeed?: number;
    CurrentClockSpeed?: number;
    L2CacheSize?: number;
    L3CacheSize?: number;
    LoadPercentage?: number;
    VirtualizationFirmwareEnabled?: boolean;
  };
  os?: {
    TotalVisibleMemorySize?: number;
    FreePhysicalMemory?: number;
    LastBootUpTime?: string;
    UptimeSeconds?: number;
    Caption?: string;
  };
  memoryModules?: { Speed?: number; ConfiguredClockSpeed?: number; FormFactor?: number }[];
  gpu?: {
    Name?: string;
    AdapterRAM?: number;
    DriverVersion?: string;
  }[];
  disks?: {
    Model?: string;
    Size?: number;
    InterfaceType?: string;
    MediaType?: string;
  }[];
  perfDisk?: {
    PercentDiskTime?: number;
    DiskReadBytesPersec?: number;
    DiskWriteBytesPersec?: number;
    AvgDiskSecPerTransfer?: number;
  };
  perfGpuPct?: number;
  processes?: {
    Id?: number;
    Name?: string;
    ProcessName?: string;
    WorkingSet64?: number;
    PriorityClass?: string;
    Threads?: number;
    Company?: string;
    Path?: string;
    CpuSeconds?: number;
    CpuPct?: number;
    DiskMbPerSec?: number;
  }[];
  startup?: {
    Name?: string;
    Command?: string;
    Location?: string;
    User?: string;
    Enabled?: boolean;
  }[];
  logicalDisks?: {
    DeviceID?: string;
    VolumeName?: string;
    FileSystem?: string;
    Size?: number;
    FreeSpace?: number;
  }[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function buildSystemSnapshotFromWmi(
  raw: RawWmiSystemPayload,
  prevHistory?: {
    cpu: number[];
    memory: number[];
    disk: number[];
    gpu: number[];
  },
): SystemSnapshot {
  const cpu = raw.cpu ?? {};
  const osInfo = raw.os ?? {};
  const modules = asArray(raw.memoryModules);
  const gpus = asArray(raw.gpu);
  const primaryGpu =
    gpus.find((g) => /nvidia|amd|radeon|intel|arc/i.test(g.Name ?? '')) ?? gpus[0] ?? {};
  const disks = asArray(raw.disks);
  const primaryDisk = disks[0] ?? {};
  const perfDisk = raw.perfDisk ?? {};

  const cpuCores = cpu.NumberOfCores || Math.max(1, Math.round(os.cpus().length / 2));
  const cpuThreads = cpu.NumberOfLogicalProcessors || os.cpus().length || 4;
  const cpuUtil = round1(Math.min(100, Math.max(0, cpu.LoadPercentage ?? 12)));
  const cpuSpeedGhz = Math.round(((cpu.CurrentClockSpeed || cpu.MaxClockSpeed || 3600) / 1000) * 100) / 100;
  const cpuBaseGhz = Math.round(((cpu.MaxClockSpeed || 3600) / 1000) * 100) / 100;

  const totalMemGb = round1(
    osInfo.TotalVisibleMemorySize
      ? osInfo.TotalVisibleMemorySize / (1024 * 1024)
      : os.totalmem() / 1024 ** 3,
  );
  const freeMemGb = round1(
    osInfo.FreePhysicalMemory
      ? osInfo.FreePhysicalMemory / (1024 * 1024)
      : os.freemem() / 1024 ** 3,
  );
  const usedMemGb = round1(Math.max(0.5, totalMemGb - freeMemGb));
  const memUtil = round1((usedMemGb / Math.max(1, totalMemGb)) * 100);
  const memSpeedMhz = modules[0]?.ConfiguredClockSpeed || modules[0]?.Speed || 3200;

  const diskReadMb = round1((perfDisk.DiskReadBytesPersec ?? 0) / (1024 * 1024));
  const diskWriteMb = round1((perfDisk.DiskWriteBytesPersec ?? 0) / (1024 * 1024));
  const diskActivePct = round1(Math.min(100, Math.max(0, perfDisk.PercentDiskTime ?? 2)));
  const diskCapGb = Math.round((primaryDisk.Size ?? 512 * 1024 ** 3) / 1024 ** 3);

  const gpuUtil = round1(Math.min(100, Math.max(0, raw.perfGpuPct ?? 4)));
  const gpuVramTotalGb = round1(
    Math.max(1, (primaryGpu.AdapterRAM ?? 8 * 1024 ** 3) / 1024 ** 3),
  );

  const uptimeSeconds = Math.max(0, Math.floor(osInfo.UptimeSeconds ?? os.uptime()));

  const pushSeries = (arr: number[] | undefined, value: number) => {
    if (!arr || arr.length < 2) {
      return Array.from({ length: 60 }, (_, i) => (i === 59 ? value : Math.max(0, round1(value * 0.85))));
    }
    return [...arr.slice(1), value];
  };

  const processes: ProcessInfo[] = asArray(raw.processes)
    .filter((p) => (p.Id ?? 0) > 0)
    .map((p) => {
      const procName = p.ProcessName || p.Name || 'Unknown';
      const exe = procName.endsWith('.exe') ? procName : `${procName}.exe`;
      const memMb = Math.round((p.WorkingSet64 ?? 0) / (1024 * 1024));
      const company = p.Company || 'Microsoft Windows';
      const isWindowsProc =
        /microsoft/i.test(company) ||
        /^(svchost|dwm|csrss|lsass|services|smss|system|explorer|searchindexer|audiodg|msmpeng)$/i.test(
          procName,
        );
      return {
        id: `pid-${p.Id}`,
        pid: p.Id ?? 0,
        name: p.Name && p.Name !== procName ? p.Name : procName,
        executable: exe,
        publisher: company,
        category: isWindowsProc ? 'Windows' : p.Path ? 'App' : 'Background',
        status: 'Running',
        cpu: round1(Math.min(100, Math.max(0, p.CpuPct ?? 0))),
        memoryMb: Math.max(1, memMb),
        diskMbPerSec: round1(Math.max(0, p.DiskMbPerSec ?? 0)),
        gpu: 0,
        priority: mapWindowsPriorityToUi(p.PriorityClass),
        threads: p.Threads ?? 1,
      };
    });

  const telemetry: HardwareTelemetry = {
    uptimeSeconds,
    cpu: {
      model: (cpu.Name || 'Windows Processor').trim(),
      utilization: cpuUtil,
      speedGhz: cpuSpeedGhz,
      baseSpeedGhz: cpuBaseGhz,
      sockets: 1,
      cores: cpuCores,
      logicalProcessors: cpuThreads,
      l1CacheKb: 512,
      l2CacheMb: Math.round((cpu.L2CacheSize ?? 4096) / 1024),
      l3CacheMb: Math.round((cpu.L3CacheSize ?? 16384) / 1024),
      virtualization: cpu.VirtualizationFirmwareEnabled ? 'Enabled' : 'Disabled',
      temperatureC: 52,
      handles: processes.length * 420,
      threads: processes.reduce((s, p) => s + p.threads, 0),
      history: pushSeries(prevHistory?.cpu, cpuUtil),
    },
    memory: {
      specLabel: `${totalMemGb.toFixed(1)} GB (${memSpeedMhz} MT/s)`,
      totalGb: totalMemGb,
      usedGb: usedMemGb,
      availableGb: freeMemGb,
      committedGb: round1(usedMemGb * 1.12),
      committedLimitGb: round1(totalMemGb * 1.25),
      cachedGb: round1(freeMemGb * 0.45),
      pagedPoolMb: 512,
      nonPagedPoolMb: 320,
      speedMhz: memSpeedMhz,
      slotsUsed: `${Math.max(1, modules.length)} slot(s)`,
      formFactor: 'DIMM',
      utilization: memUtil,
      history: pushSeries(prevHistory?.memory, memUtil),
    },
    disk: {
      model: (primaryDisk.Model || 'Windows System Disk').trim(),
      driveLetter: 'C:',
      capacityGb: diskCapGb,
      activeTimePct: diskActivePct,
      readMbPerSec: diskReadMb,
      writeMbPerSec: diskWriteMb,
      avgResponseMs: round1((perfDisk.AvgDiskSecPerTransfer ?? 0.001) * 1000),
      formattedGb: diskCapGb,
      systemDisk: true,
      type: primaryDisk.InterfaceType || primaryDisk.MediaType || 'Fixed Disk',
      history: pushSeries(prevHistory?.disk, diskActivePct),
    },
    gpu: {
      model: (primaryGpu.Name || 'Windows Display Adapter').trim(),
      driverVersion: primaryGpu.DriverVersion || 'WDDM',
      directXVersion: '12',
      utilization: gpuUtil,
      dedicatedVramUsedGb: round1((gpuUtil / 100) * gpuVramTotalGb * 0.6),
      dedicatedVramTotalGb: gpuVramTotalGb,
      sharedVramUsedGb: 0.3,
      sharedVramTotalGb: round1(totalMemGb / 2),
      temperatureC: 48,
      clockMhz: 1800,
      history: pushSeries(prevHistory?.gpu, gpuUtil),
    },
  };

  const startupApps: StartupAppEntry[] = asArray(raw.startup).map((s, idx) => ({
    id: `win-su-${idx}-${(s.Name || 'item').replace(/\W+/g, '')}`,
    name: s.Name || 'Startup Item',
    publisher: s.User || 'System',
    executable: s.Command || '',
    enabled: s.Enabled !== false,
    impact: (s.Command || '').length > 60 ? 'Medium' : 'Low',
    lastBootSeconds: s.Enabled === false ? 0 : 1.1,
  }));

  const storageDrives: StorageDrive[] = asArray(raw.logicalDisks).map((d, idx) => {
    const letter = d.DeviceID || `${String.fromCharCode(67 + idx)}:`;
    const totalGb = round1((d.Size ?? 0) / 1024 ** 3);
    const freeGb = round1((d.FreeSpace ?? 0) / 1024 ** 3);
    const usedGb = round1(Math.max(0, totalGb - freeGb));
    return {
      id: `win-drive-${letter.replace(':', '')}`,
      letter,
      label: d.VolumeName || 'Local Disk',
      fileSystem: d.FileSystem || 'NTFS',
      totalGb,
      usedGb,
      folders: scanTopLevelDriveFoldersSafe(letter, usedGb),
    };
  });

  const appHistory: AppHistoryEntry[] = asArray(raw.processes)
    .slice(0, 12)
    .map((p) => ({
      id: `hist-${p.Id}`,
      name: p.ProcessName || p.Name || 'Process',
      publisher: p.Company || 'Windows',
      cpuTimeSeconds: Math.round(p.CpuSeconds ?? 0),
      networkMb: 0,
      meteredNetworkMb: 0,
      tileUpdatesMb: 0,
    }));

  const hardwareProfile: HardwareProfile = {
    cpuModel: telemetry.cpu.model,
    cores: telemetry.cpu.cores,
    logicalProcessors: telemetry.cpu.logicalProcessors,
    memoryTotalGb: telemetry.memory.totalGb,
    memorySpeedMhz: telemetry.memory.speedMhz,
    memoryFormFactor: telemetry.memory.formFactor,
    diskModel: telemetry.disk.model,
    diskType: telemetry.disk.type,
    diskCapacityGb: telemetry.disk.capacityGb,
    gpuModel: telemetry.gpu.model,
    gpuVramTotalGb: telemetry.gpu.dedicatedVramTotalGb,
    source: 'custom',
  };

  return {
    processes,
    telemetry,
    appHistory,
    startupApps,
    storageDrives,
    hardwareProfile,
  };
}

function scanTopLevelDriveFoldersSafe(letter: string, driveUsedGb: number): StorageFolder[] {
  if (!isWindowsPlatform()) return [];
  const rootPath = `${letter}\\`;
  const candidates = ['Program Files', 'Program Files (x86)', 'Users', 'Windows', 'Games'];
  const folders: StorageFolder[] = [];
  for (const dirName of candidates) {
    const full = path.join(rootPath, dirName);
    try {
      if (!fs.existsSync(full)) continue;
      const entries = fs.readdirSync(full, { withFileTypes: true }).slice(0, 8);
      const children = entries
        .filter((e) => e.isDirectory())
        .slice(0, 5)
        .map((e) => ({
          name: e.name,
          sizeGb: 0.5,
          files: 100,
        }));
      folders.push({
        id: `${letter}-${dirName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: dirName,
        path: full,
        sizeGb: round1(Math.max(1, driveUsedGb * (dirName === 'Users' ? 0.35 : 0.15))),
        fileCount: entries.length * 120,
        category:
          dirName === 'Windows'
            ? 'System'
            : dirName === 'Games'
              ? 'Games'
              : 'Apps',
        children,
      });
    } catch {
      // Skip restricted system folders
    }
  }
  return folders;
}

const WIN_TELEMETRY_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1 Name,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed,CurrentClockSpeed,L2CacheSize,L3CacheSize,LoadPercentage,VirtualizationFirmwareEnabled
$osRaw = Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize,FreePhysicalMemory,LastBootUpTime,Caption
$uptimeSec = if ($osRaw.LastBootUpTime) { [Math]::Round(((Get-Date) - $osRaw.LastBootUpTime).TotalSeconds, 0) } else { 0 }
$os = [PSCustomObject]@{
  TotalVisibleMemorySize = $osRaw.TotalVisibleMemorySize
  FreePhysicalMemory = $osRaw.FreePhysicalMemory
  Caption = $osRaw.Caption
  UptimeSeconds = $uptimeSec
}
$mem = @(Get-CimInstance Win32_PhysicalMemory | Select-Object Speed,ConfiguredClockSpeed,FormFactor)
$gpu = @(Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion)
$disks = @(Get-CimInstance Win32_DiskDrive | Select-Object Model,Size,InterfaceType,MediaType)
$perfDisk = Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk | Where-Object { $_.Name -eq '_Total' } | Select-Object -First 1 PercentDiskTime,DiskReadBytesPersec,DiskWriteBytesPersec,AvgDiskSecPerTransfer
$gpuSamples = Get-CimInstance Win32_PerfFormattedData_GPUEngine_GPUEngine | Where-Object { $_.Name -like '*engtype_3D*' }
$perfGpuPct = if ($gpuSamples) { [Math]::Min(100, [Math]::Round(($gpuSamples | Measure-Object -Property UtilizationPercentage -Sum).Sum, 1)) } else { 0 }
$logicalDisks = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,VolumeName,FileSystem,Size,FreeSpace)
$approvedPath = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run'
$approvedProps = if (Test-Path $approvedPath) { Get-ItemProperty -Path $approvedPath } else { $null }
$startup = @(Get-CimInstance Win32_StartupCommand | ForEach-Object {
  $isEnabled = $true
  if ($approvedProps -and ($approvedProps.PSObject.Properties.Name -contains $_.Name)) {
    $bytes = $approvedProps.($_.Name)
    if ($bytes -and $bytes.Length -gt 0 -and ($bytes[0] -eq 3 -or $bytes[0] -eq 1)) {
      $isEnabled = $false
    }
  }
  [PSCustomObject]@{
    Name = $_.Name
    Command = $_.Command
    Location = $_.Location
    User = $_.User
    Enabled = $isEnabled
  }
})
$perfProcs = @{}
Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | ForEach-Object {
  if ($_.IDProcess -gt 0) {
    $perfProcs[$_.IDProcess] = $_
  }
}
$cores = [Math]::Max(1, [int]$cpu.NumberOfLogicalProcessors)
$procs = @(Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 60 | ForEach-Object {
  $perf = $perfProcs[$_.Id]
  $cpuPct = if ($perf) { [Math]::Round($perf.PercentProcessorTime / $cores, 1) } else { 0 }
  $diskMb = if ($perf) { [Math]::Round(($perf.IOReadBytesPersec + $perf.IOWriteBytesPersec) / 1048576, 2) } else { 0 }
  [PSCustomObject]@{
    Id = $_.Id
    Name = if ($_.MainWindowTitle) { $_.MainWindowTitle } else { $_.ProcessName }
    ProcessName = $_.ProcessName
    WorkingSet64 = $_.WorkingSet64
    PriorityClass = if ($_.PriorityClass) { $_.PriorityClass.ToString() } else { 'Normal' }
    Threads = $_.Threads.Count
    Company = $_.Company
    Path = $_.Path
    CpuSeconds = if ($_.CPU) { [Math]::Round($_.CPU, 0) } else { 0 }
    CpuPct = $cpuPct
    DiskMbPerSec = $diskMb
  }
})
$payload = [PSCustomObject]@{
  cpu = $cpu
  os = $os
  memoryModules = $mem
  gpu = $gpu
  disks = $disks
  perfDisk = $perfDisk
  perfGpuPct = $perfGpuPct
  logicalDisks = $logicalDisks
  startup = $startup
  processes = $procs
}
$payload | ConvertTo-Json -Depth 5 -Compress
`;

export class WindowsNativeProvider {
  private prevHistory: {
    cpu: number[];
    memory: number[];
    disk: number[];
    gpu: number[];
  } | null = null;

  async getSnapshot(): Promise<SystemSnapshot> {
    if (!isWindowsPlatform()) {
      throw new WindowsHostRequiredError(process.platform);
    }
    const stdout = await runPowerShell(WIN_TELEMETRY_SCRIPT, 15000);
    const parsed = parsePowerShellJson<RawWmiSystemPayload>(stdout);
    const snapshot = buildSystemSnapshotFromWmi(parsed, this.prevHistory ?? undefined);
    this.prevHistory = {
      cpu: snapshot.telemetry.cpu.history,
      memory: snapshot.telemetry.memory.history,
      disk: snapshot.telemetry.disk.history,
      gpu: snapshot.telemetry.gpu.history,
    };
    return snapshot;
  }

  async endProcess(pid: number): Promise<void> {
    if (!isWindowsPlatform()) {
      throw new WindowsHostRequiredError(process.platform);
    }
    if (!Number.isInteger(pid) || pid <= 4) {
      throw new Error(`Invalid or protected PID: ${pid}`);
    }
    await runPowerShell(`Stop-Process -Id ${pid} -Force -ErrorAction Stop`, 6000);
  }

  async setProcessPriority(pid: number, priority: ProcessPriority): Promise<void> {
    if (!isWindowsPlatform()) {
      throw new WindowsHostRequiredError(process.platform);
    }
    if (!Number.isInteger(pid) || pid <= 4) {
      throw new Error(`Invalid or protected PID: ${pid}`);
    }
    const winPrio = mapUiPriorityToWindows(priority);
    await runPowerShell(
      `$p = Get-Process -Id ${pid} -ErrorAction Stop; $p.PriorityClass = '${winPrio}'`,
      6000,
    );
  }

  async toggleStartupApp(name: string, enabled: boolean): Promise<void> {
    if (!isWindowsPlatform()) {
      throw new WindowsHostRequiredError(process.platform);
    }
    const safeName = name.replace(/'/g, "''").trim();
    if (!safeName) {
      throw new Error('Startup app name is required');
    }
    const byteHex = enabled ? '0x02' : '0x03';
    const script = `
$regPath = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run'
if (-not (Test-Path $regPath)) { New-Item -Path $regPath -Force | Out-Null }
$val = [byte[]](${byteHex},0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)
Set-ItemProperty -Path $regPath -Name '${safeName}' -Value $val -Type Binary -ErrorAction Stop
`;
    await runPowerShell(script, 6000);
  }
}
