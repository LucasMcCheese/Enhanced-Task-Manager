import {
  Activity,
  AppWindow,
  Box,
  Cpu,
  Folder,
  Gamepad2,
  Globe,
  HardDrive,
  MessageSquare,
  Music,
  Search,
  Shield,
  Terminal,
  Volume2,
  FileText,
} from 'lucide-react';

interface ProcessIconProps {
  id: string;
  className?: string;
}

export function ProcessIcon({ id, className = 'w-4 h-4' }: ProcessIconProps) {
  switch (id) {
    case 'chrome':
    case 'hist-chrome':
    case 'hist-edge':
      return <Globe className={`${className} text-[#60CDFF]`} aria-hidden="true" />;
    case 'discord':
    case 'hist-discord':
    case 'su-discord':
    case 'hist-teams':
      return <MessageSquare className={`${className} text-indigo-400`} aria-hidden="true" />;
    case 'steam-game':
    case 'hist-steam':
    case 'su-steam':
    case 'su-epic':
      return <Gamepad2 className={`${className} text-sky-400`} aria-hidden="true" />;
    case 'spotify':
    case 'hist-spotify':
    case 'su-spotify':
      return <Music className={`${className} text-emerald-400`} aria-hidden="true" />;
    case 'vscode':
    case 'hist-vscode':
      return <Terminal className={`${className} text-[#60CDFF]`} aria-hidden="true" />;
    case 'docker':
    case 'su-docker':
      return <Box className={`${className} text-cyan-400`} aria-hidden="true" />;
    case 'defender':
    case 'su-security':
      return <Shield className={`${className} text-emerald-400`} aria-hidden="true" />;
    case 'explorer':
      return <Folder className={`${className} text-amber-400`} aria-hidden="true" />;
    case 'system':
      return <Cpu className={`${className} text-zinc-300`} aria-hidden="true" />;
    case 'dwm':
      return <AppWindow className={`${className} text-sky-300`} aria-hidden="true" />;
    case 'nvidia':
      return <Activity className={`${className} text-lime-400`} aria-hidden="true" />;
    case 'obsidian':
      return <FileText className={`${className} text-violet-400`} aria-hidden="true" />;
    case 'search':
      return <Search className={`${className} text-zinc-400`} aria-hidden="true" />;
    case 'audio':
      return <Volume2 className={`${className} text-zinc-300`} aria-hidden="true" />;
    default:
      return <HardDrive className={`${className} text-zinc-400`} aria-hidden="true" />;
  }
}
