import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  MonitorX,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import type { WindowsRuntimeStatus } from '../services/systemService';

interface WindowsConnectionErrorViewProps {
  status: WindowsRuntimeStatus;
  errorDetail: string | null;
  isRetrying: boolean;
  onRetry: () => void;
  onOpenSimulatedPreview: () => void;
}

const LOCAL_DEV_CMD = `npm install
npm run dev`;

const EXE_BUILD_CMD = `npm install -D electron electron-builder
npm run electron:dev
npx electron-builder --win portable`;

export function WindowsConnectionErrorView({
  status,
  errorDetail,
  isRetrying,
  onRetry,
  onOpenSimulatedPreview,
}: WindowsConnectionErrorViewProps) {
  const [copiedId, setCopiedId] = useState<'dev' | 'exe' | null>(null);

  const handleCopy = (id: 'dev' | 'exe', text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedId(id);
    window.setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr));
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-[#141416] text-zinc-100 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-3xl rounded-xl border border-white/[0.08] bg-[#1b1b1f] shadow-2xl overflow-hidden">
        {/* Header Banner */}
        <div className="px-6 py-5 border-b border-white/[0.07] bg-gradient-to-r from-red-500/[0.09] via-amber-500/[0.04] to-transparent flex items-start gap-4">
          <div className="w-11 h-11 rounded-lg border border-red-400/25 bg-red-500/10 flex items-center justify-center shrink-0">
            <MonitorX className="w-5 h-5 text-red-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/15 border border-red-400/25 text-[11px] font-mono uppercase tracking-wider text-red-300">
                <AlertTriangle className="w-3 h-3" />
                {status.error || 'WINDOWS_HOST_REQUIRED'}
              </span>
              <span className="text-xs font-mono text-zinc-400">
                Host: {status.platform} · {status.runtime}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-semibold text-zinc-50 tracking-tight">
              Windows Detection Failed (Web Environment)
            </h1>
            <p className="text-sm text-zinc-300 mt-1 leading-relaxed">
              {errorDetail || status.message}
            </p>
          </div>
        </div>

        {/* Diagnostic Summary */}
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-white/[0.07] bg-[#141416] px-3.5 py-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400">
                Detected Platform
              </div>
              <div className="text-sm font-mono font-medium text-zinc-100 mt-1">
                {status.platform} ({status.arch})
              </div>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-[#141416] px-3.5 py-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400">
                Required Host
              </div>
              <div className="text-sm font-mono font-medium text-sky-300 mt-1">
                win32 (Windows 10 / 11)
              </div>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-[#141416] px-3.5 py-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400">
                Native Provider
              </div>
              <div className="text-sm font-mono font-medium text-red-300 mt-1">
                PowerShell CIM / WMI Offline
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-200/90 leading-relaxed">
            Running inside a web browser or Linux cloud container cannot query your PC&apos;s{' '}
            <span className="font-mono text-amber-100">Win32_Processor</span>,{' '}
            <span className="font-mono text-amber-100">Win32_VideoController</span>, live PIDs,
            or terminate Windows tasks. Download and run the code version locally on Windows—or
            launch it as a desktop <span className="font-mono text-amber-100">.exe</span>—to use
            your real PC specs and processes.
          </div>

          {/* Local Execution & EXE Instructions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-white/[0.08] bg-[#141416] p-4 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                  <Terminal className="w-3.5 h-3.5 text-sky-400" />
                  1. Run Code Version on Windows
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('dev', LOCAL_DEV_CMD)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors cursor-pointer"
                >
                  {copiedId === 'dev' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="text-xs font-mono text-zinc-300 bg-black/35 rounded p-3 overflow-x-auto border border-white/[0.05]">
                {LOCAL_DEV_CMD}
              </pre>
              <p className="text-[11px] text-zinc-400 mt-2.5">
                Starts the local Express + PowerShell WMI bridge on{' '}
                <span className="font-mono text-zinc-300">http://localhost:3000</span>.
              </p>
            </div>

            <div className="rounded-lg border border-white/[0.08] bg-[#141416] p-4 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  2. Run or Build Windows .EXE
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('exe', EXE_BUILD_CMD)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors cursor-pointer"
                >
                  {copiedId === 'exe' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="text-xs font-mono text-zinc-300 bg-black/35 rounded p-3 overflow-x-auto border border-white/[0.05]">
                {EXE_BUILD_CMD}
              </pre>
              <p className="text-[11px] text-zinc-400 mt-2.5">
                Wraps the app in Electron (<span className="font-mono text-zinc-300">electron/main.cjs</span>) for direct native Windows access.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-zinc-950 text-xs font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Checking Windows host...' : 'Retry Windows detection'}
            </button>

            <button
              type="button"
              onClick={onOpenSimulatedPreview}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-zinc-400" />
              Open UI Preview (Simulated Data)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
