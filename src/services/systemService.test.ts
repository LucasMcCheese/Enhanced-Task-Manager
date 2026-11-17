import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyHardwareProfile,
  createSystemService,
  detectBrowserHardware,
  filterProcesses,
  formatCpuTime,
  formatStorageSize,
  formatUptime,
  getResourceSeverity,
  parseWebGlRenderer,
  sortProcesses,
  tickHardwareTelemetry,
  tickProcesses,
} from './systemService';

test('getResourceSeverity classifies normal, high, and critical thresholds', () => {
  assert.equal(getResourceSeverity('cpu', 4.2), 'normal');
  assert.equal(getResourceSeverity('cpu', 12.0), 'high');
  assert.equal(getResourceSeverity('cpu', 28.5), 'critical');

  assert.equal(getResourceSeverity('memoryMb', 320), 'normal');
  assert.equal(getResourceSeverity('memoryMb', 1200), 'high');
  assert.equal(getResourceSeverity('memoryMb', 2600), 'critical');

  assert.equal(getResourceSeverity('diskMbPerSec', 1.2), 'normal');
  assert.equal(getResourceSeverity('diskMbPerSec', 18.0), 'high');
  assert.equal(getResourceSeverity('diskMbPerSec', 52.0), 'critical');

  assert.equal(getResourceSeverity('gpu', 5.0), 'normal');
  assert.equal(getResourceSeverity('gpu', 16.0), 'high');
  assert.equal(getResourceSeverity('gpu', 44.0), 'critical');
});

test('filterProcesses filters by name, executable, pid, and category', () => {
  const service = createSystemService();
  const { processes } = service.getInitialSnapshot();

  const chromeOnly = filterProcesses(processes, 'chrome');
  assert.equal(chromeOnly.length, 1);
  assert.equal(chromeOnly[0].executable, 'chrome.exe');

  const byPid = filterProcesses(processes, '4792');
  assert.equal(byPid.length, 1);
  assert.equal(byPid[0].name, 'Windows Explorer');

  const windowsOnly = filterProcesses(processes, '', 'Windows');
  assert.ok(windowsOnly.length >= 4);
  assert.ok(windowsOnly.every((p) => p.category === 'Windows'));

  const empty = filterProcesses(processes, 'nonexistent-process-xyz');
  assert.equal(empty.length, 0);
});

test('sortProcesses orders numeric and priority fields deterministically', () => {
  const service = createSystemService();
  const { processes } = service.getInitialSnapshot();

  const byMemDesc = sortProcesses(processes, 'memoryMb', 'desc');
  for (let i = 1; i < byMemDesc.length; i++) {
    assert.ok(byMemDesc[i - 1].memoryMb >= byMemDesc[i].memoryMb);
  }

  const byCpuAsc = sortProcesses(processes, 'cpu', 'asc');
  for (let i = 1; i < byCpuAsc.length; i++) {
    assert.ok(byCpuAsc[i - 1].cpu <= byCpuAsc[i].cpu);
  }

  const byPriorityDesc = sortProcesses(processes, 'priority', 'desc');
  assert.equal(byPriorityDesc[0].priority, 'Realtime');
});

test('endProcess, setProcessPriority, toggleStartupApp, and resetAppHistory mutate state cleanly', () => {
  const service = createSystemService();
  const snapshot = service.getInitialSnapshot();

  const afterEnd = service.endProcess(snapshot.processes, 'spotify');
  assert.equal(afterEnd.length, snapshot.processes.length - 1);
  assert.equal(afterEnd.some((p) => p.id === 'spotify'), false);

  const afterPriority = service.setProcessPriority(afterEnd, 'chrome', 'High');
  const chrome = afterPriority.find((p) => p.id === 'chrome');
  assert.equal(chrome?.priority, 'High');

  const spotifyStartupBefore = snapshot.startupApps.find((a) => a.id === 'su-spotify');
  assert.equal(spotifyStartupBefore?.enabled, false);
  const toggledStartup = service.toggleStartupApp(snapshot.startupApps, 'su-spotify');
  assert.equal(toggledStartup.find((a) => a.id === 'su-spotify')?.enabled, true);

  const resetHistory = service.resetAppHistory(snapshot.appHistory);
  assert.ok(resetHistory.every((h) => h.cpuTimeSeconds === 0 && h.networkMb === 0));
});

test('tickProcesses and tickHardwareTelemetry keep metrics bounded and advance history', () => {
  const service = createSystemService();
  const { processes, telemetry } = service.getInitialSnapshot();

  const nextProcs = tickProcesses(processes, () => 0.5);
  assert.equal(nextProcs.length, processes.length);
  for (const proc of nextProcs) {
    assert.ok(proc.cpu >= 0 && proc.cpu <= 100);
    assert.ok(proc.memoryMb >= 24);
    assert.ok(proc.diskMbPerSec >= 0);
    assert.ok(proc.gpu >= 0 && proc.gpu <= 100);
  }

  const nextTelemetry = tickHardwareTelemetry(telemetry, nextProcs, () => 0.5);
  assert.equal(nextTelemetry.uptimeSeconds, telemetry.uptimeSeconds + 1);
  assert.equal(nextTelemetry.cpu.history.length, 60);
  assert.equal(nextTelemetry.memory.history.length, 60);
  assert.equal(nextTelemetry.disk.history.length, 60);
  assert.equal(nextTelemetry.gpu.history.length, 60);
});

test('formatters produce consistent Windows-style strings', () => {
  assert.equal(formatUptime(3 * 86400 + 4 * 3600 + 5 * 60 + 9), '3:04:05:09');
  assert.equal(formatCpuTime(3665), '1:01:05');
  assert.equal(formatStorageSize(0.5), '512 MB');
  assert.equal(formatStorageSize(128.44), '128.4 GB');
});

test('parseWebGlRenderer cleans Chromium ANGLE strings accurately', () => {
  assert.equal(
    parseWebGlRenderer(
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 (0x00002484) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    ),
    'NVIDIA GeForce RTX 3070',
  );
  assert.equal(
    parseWebGlRenderer('ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)'),
    'Apple M3 Pro',
  );
  assert.equal(
    parseWebGlRenderer('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)))'),
    'Google SwiftShader (Software WebGL)',
  );
});

test('detectBrowserHardware and applyHardwareProfile update telemetry and drives cleanly', () => {
  const service = createSystemService();
  const snapshot = service.getInitialSnapshot();
  const detected = detectBrowserHardware();
  assert.ok(detected.logicalProcessors >= 1);
  assert.equal(detected.source, 'auto-detected');

  const applied = applyHardwareProfile(snapshot.telemetry, snapshot.storageDrives, {
    ...detected,
    cpuModel: 'Intel Core i7-14700K',
    cores: 20,
    logicalProcessors: 28,
    memoryTotalGb: 64,
    memorySpeedMhz: 6400,
    diskModel: 'WD_BLACK SN850X 2TB',
    diskCapacityGb: 2000,
    gpuModel: 'NVIDIA GeForce RTX 4070 Ti',
    gpuVramTotalGb: 12,
    source: 'custom',
  });

  assert.equal(applied.telemetry.cpu.model, 'Intel Core i7-14700K');
  assert.equal(applied.telemetry.cpu.logicalProcessors, 28);
  assert.equal(applied.telemetry.memory.totalGb, 64);
  assert.equal(applied.telemetry.gpu.model, 'NVIDIA GeForce RTX 4070 Ti');
  assert.equal(applied.telemetry.gpu.dedicatedVramTotalGb, 12);
  assert.equal(applied.drives[0].label, 'WD_BLACK SN850X 2TB');
  assert.equal(applied.drives[0].totalGb, 2000);
});
