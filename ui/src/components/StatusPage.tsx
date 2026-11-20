import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Circle, Loader2, Play, RefreshCw, X, XCircle } from 'lucide-react';
import type { StatusResponse } from '../lib/api';
import { getStatus, startOllama } from '../lib/api';

interface StatusPageProps {
  open: boolean;
  onClose: () => void;
}

function StatusIcon({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle2 size={16} style={{ color: '#00b894' }} />
    : <XCircle size={16} style={{ color: '#d63031' }} />;
}

export function StatusPage({ open, onClose }: StatusPageProps) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startResult, setStartResult] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getStatus();
      setStatus(s);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      refresh();
    }
  }, [open, refresh]);

  const handleStartOllama = async () => {
    setStarting(true);
    setStartResult(null);
    try {
      const result = await startOllama();
      if (result.ok) {
        setStartResult(result.status === 'already_running' ? 'Already running' : 'Started successfully');
        await refresh();
      } else {
        setStartResult(result.error || 'Failed to start');
      }
    } catch {
      setStartResult('Failed to connect to backend');
    } finally {
      setStarting(false);
    }
  };

  if (!open) return null;

  const ollamaOk = status?.ollama?.running ?? false;
  const claudeOk = status?.claude?.available ?? false;
  const anyOk = ollamaOk || claudeOk;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="rounded-2xl shadow-2xl w-[480px] max-h-[80vh] overflow-y-auto"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <div className="flex items-center gap-2.5">
            {loading ? (
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
            ) : anyOk ? (
              <CheckCircle2 size={18} style={{ color: '#00b894' }} />
            ) : (
              <AlertCircle size={18} style={{ color: '#d63031' }} />
            )}
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>System Status</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={refresh}
              className="p-1.5 rounded-lg cursor-pointer transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: 'var(--text-muted)' }}
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg cursor-pointer transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Ollama / Local */}
          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Local (Ollama)</span>
              </div>
              <StatusIcon ok={ollamaOk} />
            </div>

            <div className="flex flex-col gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex items-center justify-between">
                <span>Installed</span>
                <span style={{ color: status?.ollama.installed ? '#00b894' : '#d63031', fontWeight: 500 }}>
                  {status?.ollama.installed ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Server running</span>
                <span style={{ color: ollamaOk ? '#00b894' : '#d63031', fontWeight: 500 }}>
                  {ollamaOk ? 'Yes' : 'No'}
                </span>
              </div>
              {ollamaOk && status?.ollama.models && status.ollama.models.length > 0 && (
                <div className="flex items-start justify-between">
                  <span>Models</span>
                  <div className="text-right flex flex-col gap-0.5">
                    {status.ollama.models.map((m) => (
                      <span key={m} style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{m}</span>
                    ))}
                  </div>
                </div>
              )}
              {ollamaOk && status?.ollama.models?.length === 0 && (
                <div className="flex items-center justify-between">
                  <span>Models</span>
                  <span style={{ color: 'var(--text-muted)' }}>None downloaded yet</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span>Default model</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{status?.default_model || '—'}</span>
              </div>
            </div>

            {!ollamaOk && status?.ollama.installed && (
              <button
                onClick={handleStartOllama}
                disabled={starting}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all active:scale-[0.98]"
                style={{
                  background: 'var(--accent)',
                  color: 'white',
                  opacity: starting ? 0.7 : 1,
                }}
              >
                {starting ? (
                  <><Loader2 size={13} className="animate-spin" /> Starting Ollama...</>
                ) : (
                  <><Play size={13} /> Start Ollama</>
                )}
              </button>
            )}

            {!status?.ollama.installed && (
              <div
                className="mt-3 px-3 py-2 rounded-lg text-xs"
                style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}
              >
                Ollama is not installed.{' '}
                <a
                  href="https://ollama.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                >
                  Download it here
                </a>
              </div>
            )}

            {startResult && (
              <div
                className="mt-2 px-3 py-1.5 rounded-lg text-xs"
                style={{
                  background: startResult.includes('success') || startResult.includes('running')
                    ? 'rgba(0,184,148,0.1)' : 'rgba(214,48,49,0.1)',
                  color: startResult.includes('success') || startResult.includes('running')
                    ? '#00b894' : '#d63031',
                }}
              >
                {startResult}
              </div>
            )}
          </div>

          {/* Claude / Cloud */}
          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Cloud (Claude)</span>
              </div>
              <StatusIcon ok={claudeOk} />
            </div>

            <div className="flex flex-col gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex items-center justify-between">
                <span>API key configured</span>
                <span style={{ color: status?.claude.has_api_key ? '#00b894' : '#d63031', fontWeight: 500 }}>
                  {status?.claude.has_api_key ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Connection</span>
                <span style={{ color: claudeOk ? '#00b894' : 'var(--text-muted)', fontWeight: 500 }}>
                  {claudeOk ? 'Connected' : status?.claude.has_api_key ? 'Not reachable' : 'No API key'}
                </span>
              </div>
            </div>

            {!status?.claude.has_api_key && (
              <div
                className="mt-3 px-3 py-2 rounded-lg text-xs"
                style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}
              >
                Add your Anthropic API key in Settings to enable cloud models.
              </div>
            )}
          </div>

          {/* Overall */}
          <div className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            {anyOk ? (
              <span>
                <Circle size={8} className="inline-block mr-1" style={{ fill: '#00b894', color: '#00b894' }} />
                At least one backend is available — you're good to go.
              </span>
            ) : (
              <span>
                <Circle size={8} className="inline-block mr-1" style={{ fill: '#d63031', color: '#d63031' }} />
                No backends available. Start Ollama or add a Claude API key.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
