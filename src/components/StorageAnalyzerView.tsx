import { ChevronRight, Folder, HardDrive } from 'lucide-react';
import { useState } from 'react';
import {
  formatStorageSize,
  type StorageCategory,
  type StorageDrive,
} from '../services/systemService';

interface StorageAnalyzerViewProps {
  drives: StorageDrive[];
}

const CATEGORY_COLORS: Record<StorageCategory, string> = {
  Games: '#60CDFF',
  Apps: '#A78BFA',
  System: '#34D399',
  Media: '#F59E0B',
  Temp: '#F87171',
};

export function StorageAnalyzerView({ drives }: StorageAnalyzerViewProps) {
  const [selectedDriveId, setSelectedDriveId] = useState<string>(drives[0]?.id ?? '');
  const activeDrive = drives.find((d) => d.id === selectedDriveId) ?? drives[0];
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    activeDrive?.folders[0]?.id ?? '',
  );

  if (!activeDrive) return null;

  const freeGb = Math.max(0, activeDrive.totalGb - activeDrive.usedGb);
  const usedPct = (activeDrive.usedGb / activeDrive.totalGb) * 100;

  const sortedFolders = [...activeDrive.folders].sort((a, b) => b.sizeGb - a.sizeGb);
  const selectedFolder =
    sortedFolders.find((f) => f.id === selectedFolderId) ?? sortedFolders[0];

  const handleSelectDrive = (drive: StorageDrive) => {
    setSelectedDriveId(drive.id);
    setSelectedFolderId(drive.folders[0]?.id ?? '');
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="px-6 pt-6 pb-4 border-b border-white/[0.06] flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
            Storage Analyzer
          </h2>
          <p className="text-xs text-zinc-400 mt-1 flex flex-wrap items-center gap-2 tabular-nums">
            <span>
              {activeDrive.letter} {activeDrive.label}
            </span>
            <span aria-hidden="true">·</span>
            <span>{activeDrive.fileSystem}</span>
            <span aria-hidden="true">·</span>
            <span>{usedPct.toFixed(1)}% allocated</span>
          </p>
        </div>

        <div
          role="group"
          aria-label="Select storage drive"
          className="flex items-center gap-1.5 p-1 rounded-lg bg-[#1C1C20] border border-white/[0.07]"
        >
          {drives.map((drive) => {
            const isSelected = drive.id === activeDrive.id;
            return (
              <button
                key={drive.id}
                type="button"
                onClick={() => handleSelectDrive(drive)}
                aria-pressed={isSelected}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  isSelected ? 'bg-white/[0.11] text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5 text-[#60CDFF]" aria-hidden="true" />
                <span>
                  {drive.letter} ({drive.totalGb >= 2000 ? '4 TB' : '2 TB'})
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-auto px-6 py-5 flex flex-col gap-5">
        {/* Drive Capacity & Interactive Segmented Bar */}
        <section
          aria-label="Drive capacity breakdown"
          className="p-5 rounded-xl bg-[#1B1B1F]/85 backdrop-blur-xl border border-white/[0.08]"
        >
          <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
            <div>
              <div className="text-xs text-zinc-400">Used space on {activeDrive.letter}</div>
              <div className="font-mono text-2xl font-semibold text-white mt-0.5 tabular-nums">
                {activeDrive.usedGb.toLocaleString('en-US', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{' '}
                GB{' '}
                <span className="text-sm font-normal text-zinc-400">
                  of {activeDrive.totalGb.toLocaleString('en-US')} GB
                </span>
              </div>
            </div>
            <div className="sm:text-right">
              <div className="text-xs text-zinc-400">Free space</div>
              <div className="font-mono text-lg font-semibold text-zinc-200 tabular-nums">
                {freeGb.toLocaleString('en-US', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{' '}
                GB
              </div>
            </div>
          </div>

          {/* Interactive Stacked Proportional Bar */}
          <div
            className="w-full h-7 rounded-lg bg-[#141416] border border-white/[0.08] p-1 flex items-stretch gap-1 overflow-hidden"
            role="group"
            aria-label="Interactive folder usage proportions"
          >
            {sortedFolders.map((folder) => {
              const pct = (folder.sizeGb / activeDrive.totalGb) * 100;
              const isSelected = selectedFolder?.id === folder.id;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setSelectedFolderId(folder.id)}
                  aria-label={`Inspect ${folder.name}: ${formatStorageSize(folder.sizeGb)}`}
                  aria-pressed={isSelected}
                  style={{
                    width: `${Math.max(pct, 2.5)}%`,
                    backgroundColor: CATEGORY_COLORS[folder.category],
                  }}
                  className={`h-full rounded-[4px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    isSelected
                      ? 'opacity-100 ring-1 ring-white/80'
                      : 'opacity-75 hover:opacity-95'
                  }`}
                />
              );
            })}
            <div
              className="flex-1 h-full rounded-[4px] bg-white/[0.04]"
              title={`Free space: ${freeGb.toFixed(1)} GB`}
            />
          </div>

          {/* Legend */}
          <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-400">
            {(Object.keys(CATEGORY_COLORS) as StorageCategory[]).map((cat) => (
              <div key={cat} className="inline-flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                />
                <span>{cat}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Top Space-Hogging Folders + Subfolder Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <section
            aria-label="Top space-hogging folders"
            className="lg:col-span-7 rounded-xl bg-[#1B1B1F]/85 border border-white/[0.08] overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-white/[0.07] bg-[#1F1F24]/90 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-zinc-100">
                Top space-hogging folders
              </h3>
              <span className="text-xs text-zinc-400 tabular-nums">
                {sortedFolders.length} directories scanned
              </span>
            </div>

            <div className="divide-y divide-white/[0.05]">
              {sortedFolders.map((folder) => {
                const isSelected = selectedFolder?.id === folder.id;
                const pctOfUsed = (folder.sizeGb / activeDrive.usedGb) * 100;
                const color = CATEGORY_COLORS[folder.category];
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setSelectedFolderId(folder.id)}
                    aria-pressed={isSelected}
                    className={`w-full text-left px-4 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#60CDFF] ${
                      isSelected ? 'bg-[#60CDFF]/10' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-white/[0.08]"
                        style={{ backgroundColor: `${color}1A` }}
                      >
                        <Folder className="w-4 h-4" style={{ color }} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-100 truncate">
                            {folder.name}
                          </span>
                          <span className="text-[11px] text-zinc-400 shrink-0">
                            · {folder.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono truncate mt-0.5">
                          {folder.path}
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/[0.06] mt-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-200"
                            style={{
                              width: `${pctOfUsed.toFixed(1)}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pl-11 sm:pl-0 shrink-0">
                      <div className="sm:text-right flex sm:block items-baseline gap-2">
                        <div className="font-mono text-sm font-semibold text-white tabular-nums">
                          {formatStorageSize(folder.sizeGb)}
                        </div>
                        <div className="font-mono text-[11px] text-zinc-400 tabular-nums">
                          {pctOfUsed.toFixed(1)}% · {folder.fileCount.toLocaleString()} files
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 transition-transform ${
                          isSelected ? 'text-[#60CDFF] translate-x-0.5' : 'text-zinc-500'
                        }`}
                        aria-hidden="true"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Subfolder Breakdown Panel */}
          {selectedFolder && (
            <section
              aria-label={`Contents of ${selectedFolder.name}`}
              className="lg:col-span-5 p-5 rounded-xl bg-[#1B1B1F]/85 border border-white/[0.08]"
            >
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/[0.07]">
                <div className="min-w-0">
                  <div className="text-xs text-zinc-400">Directory breakdown</div>
                  <h3 className="font-display text-lg font-semibold text-white truncate mt-0.5">
                    {selectedFolder.name}
                  </h3>
                  <p className="text-[11px] font-mono text-zinc-400 truncate mt-0.5">
                    {selectedFolder.path}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-lg font-semibold text-[#60CDFF] tabular-nums">
                    {formatStorageSize(selectedFolder.sizeGb)}
                  </div>
                  <div className="text-[11px] text-zinc-400 tabular-nums">
                    {selectedFolder.fileCount.toLocaleString()} files
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3.5">
                {selectedFolder.children.map((child) => {
                  const pct = (child.sizeGb / selectedFolder.sizeGb) * 100;
                  return (
                    <div key={child.name} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="font-medium text-zinc-200 truncate">{child.name}</span>
                        <span className="font-mono text-zinc-100 tabular-nums shrink-0">
                          {formatStorageSize(child.sizeGb)}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct.toFixed(1)}%`,
                            backgroundColor: CATEGORY_COLORS[selectedFolder.category],
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono tabular-nums">
                        <span>{child.files.toLocaleString()} files</span>
                        <span>{pct.toFixed(0)}% of folder</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
