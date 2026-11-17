/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AlertTriangle, RefreshCw, Terminal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppHistoryView } from './components/AppHistoryView';
import { HardwareProfileModal } from './components/HardwareProfileModal';
import { PerformanceView } from './components/PerformanceView';
import { ProcessesView } from './components/ProcessesView';
import { Sidebar } from './components/Sidebar';
import { StartupAppsView } from './components/StartupAppsView';
import { StorageAnalyzerView } from './components/StorageAnalyzerView';
import { ToastContainer, type ToastMessage } from './components/ToastContainer';
import { WindowsConnectionErrorView } from './components/WindowsConnectionErrorView';
import {
  applyHardwareProfile,
  clearHardwareProfile,
  createSystemService,
  detectBrowserHardware,
  endWindowsProcess,
  fetchWindowsRuntimeStatus,
  fetchWindowsSnapshot,
  saveHardwareProfile,
  setWindowsProcessPriority,
  toggleWindowsStartupApp,
  type AppHistoryEntry,
  type HardwareProfile,
  type HardwareTelemetry,
  type ProcessInfo,
  type ProcessPriority,
  type StartupAppEntry,
  type StorageDrive,
  type TabId,
  type WindowsRuntimeStatus,
} from './services/systemService';

type RuntimeMode = 'checking' | 'native-windows' | 'web-failed' | 'preview-simulated';

export default function App() {
  const systemService = useMemo(() => createSystemService(), []);
  const initial = useMemo(() => systemService.getInitialSnapshot(), [systemService]);

  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>('checking');
  const [windowsStatus, setWindowsStatus] = useState<WindowsRuntimeStatus>({
    isWindowsHost: false,
    platform: 'unknown',
    arch: 'unknown',
    hostname: 'localhost',
    runtime: 'node-web',
    error: 'WINDOWS_HOST_REQUIRED',
    message: 'Probing local Windows CIM/WMI telemetry host...',
  });
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isRetryingDetection, setIsRetryingDetection] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<TabId>('processes');
  const [liveState, setLiveState] = useState<{
    processes: ProcessInfo[];
    telemetry: HardwareTelemetry;
  }>(() => ({
    processes: initial.processes,
    telemetry: initial.telemetry,
  }));
  const [appHistory, setAppHistory] = useState<AppHistoryEntry[]>(initial.appHistory);
  const [startupApps, setStartupApps] = useState<StartupAppEntry[]>(initial.startupApps);
  const [storageDrives, setStorageDrives] = useState<StorageDrive[]>(initial.storageDrives);
  const [hardwareProfile, setHardwareProfile] = useState<HardwareProfile>(initial.hardwareProfile);
  const [isSpecsModalOpen, setIsSpecsModalOpen] = useState<boolean>(false);

  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [refreshMs, setRefreshMs] = useState<number>(1500);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-2), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const detectWindowsHost = useCallback(async () => {
    setIsRetryingDetection(true);
    try {
      const status = await fetchWindowsRuntimeStatus();
      setWindowsStatus(status);
      if (!status.isWindowsHost) {
        setConnectionError(status.message);
        setRuntimeMode('web-failed');
        return;
      }
      const snapshot = await fetchWindowsSnapshot();
      setLiveState({
        processes: snapshot.processes,
        telemetry: snapshot.telemetry,
      });
      setAppHistory(snapshot.appHistory);
      setStartupApps(snapshot.startupApps);
      setStorageDrives(snapshot.storageDrives);
      setHardwareProfile(snapshot.hardwareProfile);
      setConnectionError(null);
      setRuntimeMode('native-windows');
    } catch (err) {
      setConnectionError(
        err instanceof Error
          ? err.message
          : 'Windows detection failed. Run the code version locally on Windows or as an .exe.',
      );
      setRuntimeMode('web-failed');
    } finally {
      setIsRetryingDetection(false);
    }
  }, []);

  useEffect(() => {
    detectWindowsHost();
  }, [detectWindowsHost]);

  // Native Windows polling loop OR simulated preview tick loop
  useEffect(() => {
    if (isPaused) return;
    if (runtimeMode === 'native-windows') {
      let cancelled = false;
      const pollInterval = Math.max(1500, refreshMs);
      const timer = window.setInterval(async () => {
        try {
          const snapshot = await fetchWindowsSnapshot();
          if (cancelled) return;
          setLiveState({
            processes: snapshot.processes,
            telemetry: snapshot.telemetry,
          });
          setAppHistory(snapshot.appHistory);
          setStartupApps(snapshot.startupApps);
          setStorageDrives(snapshot.storageDrives);
          setHardwareProfile(snapshot.hardwareProfile);
        } catch (err) {
          if (cancelled) return;
          setConnectionError(
            err instanceof Error ? err.message : 'Lost connection to Windows telemetry host.',
          );
          setRuntimeMode('web-failed');
        }
      }, pollInterval);

      return () => {
        cancelled = true;
        window.clearInterval(timer);
      };
    }

    if (runtimeMode === 'preview-simulated') {
      const interval = window.setInterval(() => {
        setLiveState((prev) => systemService.tick(prev.processes, prev.telemetry));
      }, refreshMs);

      return () => window.clearInterval(interval);
    }
  }, [isPaused, refreshMs, runtimeMode, systemService]);

  const handleEndTask = useCallback(
    async (proc: ProcessInfo) => {
      if (runtimeMode === 'native-windows') {
        try {
          await endWindowsProcess(proc.pid);
          setLiveState((prev) => ({
            ...prev,
            processes: systemService.endProcess(prev.processes, proc.id),
          }));
          setSelectedProcessId((curr) => (curr === proc.id ? null : curr));
          pushToast({
            title: `Ended ${proc.name}`,
            description: `Terminated Windows PID ${proc.pid} (${proc.executable})`,
            variant: 'success',
          });
        } catch (err) {
          pushToast({
            title: `Could not end ${proc.name}`,
            description:
              err instanceof Error ? err.message : 'Access denied or protected system process.',
            variant: 'error',
          });
        }
        return;
      }

      setLiveState((prev) => ({
        ...prev,
        processes: systemService.endProcess(prev.processes, proc.id),
      }));
      setSelectedProcessId((curr) => (curr === proc.id ? null : curr));
      pushToast({
        title: `Ended ${proc.name}`,
        description: `Terminated ${proc.executable} (PID ${proc.pid})`,
        variant: 'success',
      });
    },
    [pushToast, runtimeMode, systemService],
  );

  const handleSetPriority = useCallback(
    async (proc: ProcessInfo, priority: ProcessPriority) => {
      if (runtimeMode === 'native-windows') {
        try {
          await setWindowsProcessPriority(proc.pid, priority);
          setLiveState((prev) => ({
            ...prev,
            processes: systemService.setProcessPriority(prev.processes, proc.id, priority),
          }));
          pushToast({
            title: `Priority set to ${priority}`,
            description: `Updated PID ${proc.pid} (${proc.executable})`,
            variant: 'info',
          });
        } catch (err) {
          pushToast({
            title: `Could not change priority`,
            description:
              err instanceof Error ? err.message : 'Requires administrator privileges on Windows.',
            variant: 'error',
          });
        }
        return;
      }

      setLiveState((prev) => ({
        ...prev,
        processes: systemService.setProcessPriority(prev.processes, proc.id, priority),
      }));
      pushToast({
        title: `Priority set to ${priority}`,
        description: `${proc.name} (${proc.executable})`,
        variant: 'info',
      });
    },
    [pushToast, runtimeMode, systemService],
  );

  const handleToggleStartup = useCallback(
    async (app: StartupAppEntry) => {
      const nextEnabled = !app.enabled;
      if (runtimeMode === 'native-windows') {
        try {
          await toggleWindowsStartupApp(app.name, nextEnabled);
          setStartupApps((prev) => systemService.toggleStartupApp(prev, app.id));
          pushToast({
            title: `${app.name} ${nextEnabled ? 'enabled' : 'disabled'}`,
            description: 'Updated Windows StartupApproved registry entry',
            variant: 'info',
          });
        } catch (err) {
          pushToast({
            title: `Could not update ${app.name}`,
            description:
              err instanceof Error ? err.message : 'Registry modification failed.',
            variant: 'error',
          });
        }
        return;
      }

      setStartupApps((prev) => systemService.toggleStartupApp(prev, app.id));
      pushToast({
        title: `${app.name} ${nextEnabled ? 'enabled' : 'disabled'}`,
        description: 'Startup status updated (simulated)',
        variant: 'info',
      });
    },
    [pushToast, runtimeMode, systemService],
  );

  const handleResetAppHistory = useCallback(() => {
    setAppHistory((prev) => systemService.resetAppHistory(prev));
    pushToast({
      title: 'Usage history cleared',
      description: 'Reset historical CPU time and network counters',
      variant: 'success',
    });
  }, [pushToast, systemService]);

  const handleChangeRefreshMs = useCallback((ms: number) => {
    setRefreshMs(ms);
    setIsPaused(false);
  }, []);

  const handleSaveHardwareProfile = useCallback(
    (nextProfile: HardwareProfile) => {
      saveHardwareProfile(nextProfile);
      setHardwareProfile(nextProfile);
      const applied = applyHardwareProfile(liveState.telemetry, storageDrives, nextProfile);
      setLiveState((prev) => ({ ...prev, telemetry: applied.telemetry }));
      setStorageDrives(applied.drives);
      setIsSpecsModalOpen(false);
      pushToast({
        title: 'Hardware profile updated',
        description: `${nextProfile.cpuModel} · ${nextProfile.memoryTotalGb} GB RAM`,
        variant: 'success',
      });
    },
    [liveState.telemetry, pushToast, storageDrives],
  );

  const handleResetHardwareProfile = useCallback(() => {
    clearHardwareProfile();
    const detected = detectBrowserHardware();
    setHardwareProfile(detected);
    const applied = applyHardwareProfile(liveState.telemetry, storageDrives, detected);
    setLiveState((prev) => ({ ...prev, telemetry: applied.telemetry }));
    setStorageDrives(applied.drives);
    setIsSpecsModalOpen(false);
    pushToast({
      title: 'Specs reset to browser-detected',
      description: `${detected.logicalProcessors} threads · ${detected.gpuModel}`,
      variant: 'info',
    });
  }, [liveState.telemetry, pushToast, storageDrives]);

  if (runtimeMode === 'checking') {
    return (
      <div className="min-h-screen bg-[#141416] text-zinc-200 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-white/[0.08] bg-[#1b1b1f]">
          <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" />
          <span className="text-sm font-medium">Checking Windows CIM/WMI host connection...</span>
        </div>
      </div>
    );
  }

  if (runtimeMode === 'web-failed') {
    return (
      <WindowsConnectionErrorView
        status={windowsStatus}
        errorDetail={connectionError}
        isRetrying={isRetryingDetection}
        onRetry={detectWindowsHost}
        onOpenSimulatedPreview={() => setRuntimeMode('preview-simulated')}
      />
    );
  }

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[#141416] text-zinc-100 flex flex-col lg:flex-row">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        refreshMs={refreshMs}
        isPaused={isPaused}
        onTogglePause={() => setIsPaused((p) => !p)}
        onChangeRefreshMs={handleChangeRefreshMs}
        processCount={liveState.processes.length}
      />

      <main className="flex-1 min-w-0 min-h-0 flex flex-col bg-[#161619]">
        {runtimeMode === 'preview-simulated' && (
          <div className="px-4 py-2 border-b border-amber-400/20 bg-amber-500/[0.08] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                Windows detection failed (web runtime ·{' '}
                <span className="font-mono">{windowsStatus.platform}</span>) · Viewing simulated data
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={detectWindowsHost}
                disabled={isRetryingDetection}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-zinc-100 text-[11px] font-medium transition-colors cursor-pointer"
              >
                <RefreshCw
                  className={`w-3 h-3 ${isRetryingDetection ? 'animate-spin' : ''}`}
                />
                Retry Windows
              </button>
              <button
                type="button"
                onClick={() => setRuntimeMode('web-failed')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-amber-100 text-[11px] font-medium transition-colors cursor-pointer"
              >
                <Terminal className="w-3 h-3" />
                View native setup
              </button>
            </div>
          </div>
        )}

        {activeTab === 'processes' && (
          <ProcessesView
            processes={liveState.processes}
            telemetry={liveState.telemetry}
            selectedProcessId={selectedProcessId}
            onSelectProcess={setSelectedProcessId}
            onEndTask={handleEndTask}
            onSetPriority={handleSetPriority}
          />
        )}

        {activeTab === 'performance' && (
          <PerformanceView
            telemetry={liveState.telemetry}
            processCount={liveState.processes.length}
            hardwareProfile={hardwareProfile}
            onOpenSpecsModal={() => setIsSpecsModalOpen(true)}
            isNativeWindows={runtimeMode === 'native-windows'}
          />
        )}

        {activeTab === 'app-history' && (
          <AppHistoryView history={appHistory} onResetHistory={handleResetAppHistory} />
        )}

        {activeTab === 'startup-apps' && (
          <StartupAppsView apps={startupApps} onToggleApp={handleToggleStartup} />
        )}

        {activeTab === 'storage-analyzer' && <StorageAnalyzerView drives={storageDrives} />}
      </main>

      {isSpecsModalOpen && runtimeMode !== 'native-windows' && (
        <HardwareProfileModal
          profile={hardwareProfile}
          onSave={handleSaveHardwareProfile}
          onResetToAutoDetected={handleResetHardwareProfile}
          onClose={() => setIsSpecsModalOpen(false)}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
