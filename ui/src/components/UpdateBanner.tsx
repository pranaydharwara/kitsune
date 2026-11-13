import { Download, RefreshCw, X } from 'lucide-react';
import type { UpdateStatus } from '../hooks/useUpdater';

interface UpdateBannerProps {
  status: UpdateStatus;
  version: string | null;
  progress: number;
  onInstall: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({ status, version, progress, onInstall, onDismiss }: UpdateBannerProps) {
  if (status === 'idle' || status === 'error') return null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 text-xs"
      style={{
        background: 'var(--accent)',
        color: '#fff',
      }}
    >
      {status === 'available' && (
        <>
          <Download size={13} />
          <span className="flex-1">
            Kitsune <strong>{version}</strong> is available
          </span>
          <button
            onClick={onInstall}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-opacity hover:opacity-90"
            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
          >
            Update now
          </button>
          <button
            onClick={onDismiss}
            className="p-0.5 rounded cursor-pointer transition-opacity hover:opacity-80"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            <X size={13} />
          </button>
        </>
      )}

      {status === 'downloading' && (
        <>
          <RefreshCw size={13} className="animate-spin" />
          <span className="flex-1">
            Downloading update… {progress}%
          </span>
          <div
            className="h-1.5 rounded-full flex-1 max-w-[120px]"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: '#fff' }}
            />
          </div>
        </>
      )}

      {status === 'ready' && (
        <>
          <Download size={13} />
          <span className="flex-1">
            Update installed — restart to apply
          </span>
          <span className="text-[11px]" style={{ opacity: 0.8 }}>
            Reopen the app to apply
          </span>
        </>
      )}
    </div>
  );
}
