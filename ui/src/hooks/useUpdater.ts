import { useCallback, useEffect, useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';

export type UpdateStatus = 'idle' | 'available' | 'downloading' | 'ready' | 'error';

interface UpdateState {
  status: UpdateStatus;
  version: string | null;
  error: string | null;
  progress: number;
}

export function useUpdater() {
  const [state, setState] = useState<UpdateState>({
    status: 'idle',
    version: null,
    error: null,
    progress: 0,
  });

  const checkForUpdate = useCallback(async () => {
    try {
      const update = await check();
      if (update) {
        setState({ status: 'available', version: update.version, error: null, progress: 0 });
        return update;
      }
    } catch (e) {
      console.warn('Update check failed:', e);
    }
    return null;
  }, []);

  const installUpdate = useCallback(async () => {
    try {
      const update = await check();
      if (!update) return;

      setState(s => ({ ...s, status: 'downloading', progress: 0 }));

      let downloaded = 0;
      let total = 0;

      await update.downloadAndInstall((event) => {
        if (event.event === 'Started' && event.data.contentLength) {
          total = event.data.contentLength;
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          const pct = total > 0 ? Math.round((downloaded / total) * 100) : 0;
          setState(s => ({ ...s, progress: pct }));
        } else if (event.event === 'Finished') {
          setState(s => ({ ...s, status: 'ready', progress: 100 }));
        }
      });

      setState(s => ({ ...s, status: 'ready', progress: 100 }));
    } catch (e) {
      setState(s => ({ ...s, status: 'error', error: String(e) }));
    }
  }, []);

  const dismiss = useCallback(() => {
    setState({ status: 'idle', version: null, error: null, progress: 0 });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => checkForUpdate(), 3000);
    const interval = setInterval(() => checkForUpdate(), 60 * 60 * 1000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [checkForUpdate]);

  return { ...state, checkForUpdate, installUpdate, dismiss };
}
