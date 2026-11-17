import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSystemSnapshotFromWmi,
  isWindowsPlatform,
  mapUiPriorityToWindows,
  mapWindowsPriorityToUi,
  parsePowerShellJson,
  WindowsHostRequiredError,
  WindowsNativeProvider,
} from './windowsNativeProvider.ts';

test('isWindowsPlatform accurately identifies win32 hosts vs web/linux hosts', () => {
  assert.equal(isWindowsPlatform('win32'), true);
  assert.equal(isWindowsPlatform('linux'), false);
  assert.equal(isWindowsPlatform('darwin'), false);
});

test('priority mappers round-trip between UI labels and Windows PriorityClass strings', () => {
  assert.equal(mapUiPriorityToWindows('Low'), 'Idle');
  assert.equal(mapUiPriorityToWindows('Below Normal'), 'BelowNormal');
  assert.equal(mapUiPriorityToWindows('Normal'), 'Normal');
  assert.equal(mapUiPriorityToWindows('Above Normal'), 'AboveNormal');
  assert.equal(mapUiPriorityToWindows('High'), 'High');
  assert.equal(mapUiPriorityToWindows('Realtime'), 'RealTime');

  assert.equal(mapWindowsPriorityToUi('Idle'), 'Low');
  assert.equal(mapWindowsPriorityToUi('BelowNormal'), 'Below Normal');
  assert.equal(mapWindowsPriorityToUi('AboveNormal'), 'Above Normal');
  assert.equal(mapWindowsPriorityToUi('RealTime'), 'Realtime');
  assert.equal(mapWindowsPriorityToUi(13), 'High');
});

test('parsePowerShellJson parses compressed CIM JSON and rejects empty stdout', () => {
  const parsed = parsePowerShellJson<{ Name: string }>('{"Name":"AMD Ryzen 7 7800X3D"}');
  assert.equal(parsed.Name, 'AMD Ryzen 7 7800X3D');
  assert.throws(() => parsePowerShellJson('   '), /Empty PowerShell JSON output/);
});

test('buildSystemSnapshotFromWmi maps real Windows CIM/WMI hardware, processes, startup, and drives', () => {
  const snapshot = buildSystemSnapshotFromWmi({
    cpu: {
      Name: 'AMD Ryzen 7 7800X3D 8-Core Processor',
      NumberOfCores: 8,
      NumberOfLogicalProcessors: 16,
      MaxClockSpeed: 4200,
      CurrentClockSpeed: 4850,
      L2CacheSize: 8192,
      L3CacheSize: 98304,
      LoadPercentage: 22,
      VirtualizationFirmwareEnabled: true,
    },
    os: {
      TotalVisibleMemorySize: 33554432, // 32 GB in KB
      FreePhysicalMemory: 16777216, // 16 GB in KB
      UptimeSeconds: 7200,
    },
    memoryModules: [{ ConfiguredClockSpeed: 6000 }, { ConfiguredClockSpeed: 6000 }],
    gpu: [
      { Name: 'Microsoft Basic Display Adapter', AdapterRAM: 1073741824 },
      { Name: 'NVIDIA GeForce RTX 4070 Ti SUPER', AdapterRAM: 17179869184, DriverVersion: '566.36' },
    ],
    disks: [{ Model: 'WD_BLACK SN850X 2000GB', Size: 2000398934016, InterfaceType: 'NVMe' }],
    perfDisk: { PercentDiskTime: 9.4, DiskReadBytesPersec: 10485760, DiskWriteBytesPersec: 5242880 },
    perfGpuPct: 18.5,
    processes: [
      {
        Id: 4120,
        Name: 'Mozilla Firefox',
        ProcessName: 'firefox',
        WorkingSet64: 1073741824,
        PriorityClass: 'Normal',
        Threads: 44,
        Company: 'Mozilla Corporation',
        Path: 'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
        CpuSeconds: 180,
        CpuPct: 8.4,
        DiskMbPerSec: 1.2,
      },
    ],
    startup: [
      { Name: 'Steam', Command: '"C:\\Program Files (x86)\\Steam\\steam.exe" -silent', User: 'NT AUTHORITY\\SYSTEM', Enabled: false },
    ],
    logicalDisks: [
      { DeviceID: 'C:', VolumeName: 'Windows', FileSystem: 'NTFS', Size: 1073741824000, FreeSpace: 536870912000 },
    ],
  });

  assert.equal(snapshot.telemetry.cpu.model, 'AMD Ryzen 7 7800X3D 8-Core Processor');
  assert.equal(snapshot.telemetry.cpu.cores, 8);
  assert.equal(snapshot.telemetry.cpu.logicalProcessors, 16);
  assert.equal(snapshot.telemetry.uptimeSeconds, 7200);
  assert.equal(snapshot.telemetry.memory.totalGb, 32);
  assert.equal(snapshot.telemetry.memory.speedMhz, 6000);
  assert.equal(snapshot.telemetry.gpu.model, 'NVIDIA GeForce RTX 4070 Ti SUPER');
  assert.equal(snapshot.telemetry.gpu.dedicatedVramTotalGb, 16);
  assert.equal(snapshot.telemetry.gpu.utilization, 18.5);
  assert.equal(snapshot.processes[0]?.executable, 'firefox.exe');
  assert.equal(snapshot.processes[0]?.memoryMb, 1024);
  assert.equal(snapshot.startupApps[0]?.enabled, false);
  assert.equal(snapshot.storageDrives[0]?.letter, 'C:');
  assert.equal(snapshot.storageDrives[0]?.totalGb, 1000);
});

test('WindowsNativeProvider rejects non-Windows hosts with WindowsHostRequiredError', async () => {
  if (process.platform === 'win32') return;
  const provider = new WindowsNativeProvider();
  await assert.rejects(() => provider.getSnapshot(), WindowsHostRequiredError);
  await assert.rejects(() => provider.endProcess(1234), WindowsHostRequiredError);
  await assert.rejects(() => provider.setProcessPriority(1234, 'High'), WindowsHostRequiredError);
  await assert.rejects(() => provider.toggleStartupApp('Steam', false), WindowsHostRequiredError);
});
