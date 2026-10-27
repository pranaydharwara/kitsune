import { useEffect, useRef, useState } from 'react';
import { X, Eye, EyeOff, Trash2, Download, Upload } from 'lucide-react';
import type { Settings as SettingsType, UsageStats } from '../lib/api';
import { getSettings, updateSettings, clearApiKey, getUsage, exportAll, importConversations } from '../lib/api';

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export function Settings({ open, onClose, onRefresh }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'general' | 'usage' | 'data'>('general');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      getSettings().then(setSettings).catch(() => {});
      getUsage().then(setUsage).catch(() => {});
      setApiKey('');
      setShowKey(false);
    }
  }, [open]);

  const doImport = async (file: File) => {
    setImportStatus('Importing...');
    try {
      const result = await importConversations(file);
      setImportStatus(`Imported ${result.imported} conversation${result.imported !== 1 ? 's' : ''}`);
      onRefresh?.();
    } catch (err) {
      setImportStatus(`Error: ${err instanceof Error ? err.message : 'Import failed'}`);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!open) return null;

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    await updateSettings({ anthropic_api_key: apiKey.trim() });
    const updated = await getSettings();
    setSettings(updated);
    setApiKey('');
    setSaving(false);
  };

  const handleClearKey = async () => {
    await clearApiKey();
    const updated = await getSettings();
    setSettings(updated);
  };

  const handleModeChange = async (mode: string) => {
    await updateSettings({ default_mode: mode } as Partial<SettingsType>);
    const updated = await getSettings();
    setSettings(updated);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div
        className="w-[520px] max-h-[80vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Settings</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg cursor-pointer transition-all active:scale-[0.9]" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1 px-6 pt-3">
          {(['general', 'usage', 'data'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all"
              style={{
                background: tab === t ? 'var(--bg-secondary)' : 'transparent',
                color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                border: tab === t ? '1px solid var(--border-light)' : '1px solid transparent',
              }}
            >
              {t === 'general' ? 'General' : t === 'usage' ? 'Usage' : 'Data'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === 'general' && settings && (
            <div className="space-y-6">
              <Section title="Anthropic API Key" description="Direct API access is faster than the CLI. Your key is stored locally.">
                {settings.has_api_key ? (
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-1 px-3 py-2 rounded-lg text-sm font-mono"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
                    >
                      {settings.anthropic_api_key}
                    </div>
                    <button
                      onClick={handleClearKey}
                      className="p-2 rounded-lg cursor-pointer transition-all active:scale-[0.9]"
                      style={{ color: '#d63031', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-ant-..."
                        className="w-full px-3 py-2 rounded-lg text-sm font-mono pr-9 outline-none"
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
                      />
                      <button
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <button
                      onClick={handleSaveKey}
                      disabled={!apiKey.trim() || saving}
                      className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all active:scale-[0.97] disabled:opacity-40"
                      style={{ background: 'var(--accent)', color: '#fff' }}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </Section>

              <Section title="Default Mode" description="How Kitsune routes your messages by default.">
                <div className="flex gap-2">
                  {['auto', 'local', 'cloud'].map((m) => (
                    <button
                      key={m}
                      onClick={() => handleModeChange(m)}
                      className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all active:scale-[0.97]"
                      style={{
                        background: settings.default_mode === m ? 'var(--accent)' : 'var(--bg-secondary)',
                        color: settings.default_mode === m ? '#fff' : 'var(--text-secondary)',
                        border: `1px solid ${settings.default_mode === m ? 'var(--accent)' : 'var(--border-light)'}`,
                      }}
                    >
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {tab === 'usage' && usage && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Total Messages" value={usage.total_messages} />
                <StatCard label="Cloud Messages" value={usage.cloud_messages} />
                <StatCard label="Local Messages" value={usage.local_messages} />
                <StatCard label="Tokens In" value={formatNumber(usage.total_tokens_in)} />
                <StatCard label="Tokens Out" value={formatNumber(usage.total_tokens_out)} />
                <StatCard label="Estimated Cost" value={`$${usage.total_cost?.toFixed(4) || '0.00'}`} />
              </div>
            </div>
          )}

          {tab === 'data' && (
            <div className="space-y-6">
              <Section title="Export" description="Download all your conversations as a JSON file.">
                <button
                  onClick={async () => {
                    try {
                      const { content, filename } = await exportAll();
                      if (window.__TAURI_INTERNALS__) {
                        const { save } = await import('@tauri-apps/plugin-dialog');
                        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
                        const path = await save({ defaultPath: filename, filters: [{ name: 'JSON', extensions: ['json'] }] });
                        if (path) {
                          await writeTextFile(path, content);
                          setImportStatus('Exported successfully');
                        }
                      } else {
                        const blob = new Blob([content], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }
                    } catch (err) {
                      setImportStatus(`Error: ${err instanceof Error ? err.message : 'Export failed'}`);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all active:scale-[0.97]"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
                >
                  <Download size={14} />
                  Export all conversations
                </button>
              </Section>

              <Section title="Import" description="Import conversations from a Kitsune export or a Claude.ai export (JSON).">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    doImport(file);
                  }}
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      if (window.__TAURI_INTERNALS__) {
                        const { open } = await import('@tauri-apps/plugin-dialog');
                        const { readTextFile } = await import('@tauri-apps/plugin-fs');
                        const path = await open({ filters: [{ name: 'JSON', extensions: ['json'] }], multiple: false });
                        if (path) {
                          setImportStatus('Importing...');
                          try {
                            const content = await readTextFile(path as string);
                            const blob = new Blob([content], { type: 'application/json' });
                            const file = new File([blob], 'import.json', { type: 'application/json' });
                            const result = await importConversations(file);
                            setImportStatus(`Imported ${result.imported} conversation${result.imported !== 1 ? 's' : ''}`);
                            onRefresh?.();
                          } catch (err) {
                            setImportStatus(`Error: ${err instanceof Error ? err.message : 'Import failed'}`);
                          }
                        }
                      } else {
                        fileInputRef.current?.click();
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all active:scale-[0.97]"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
                  >
                    <Upload size={14} />
                    Choose JSON file
                  </button>
                  {importStatus && (
                    <span className="text-xs" style={{ color: importStatus.startsWith('Error') ? '#d63031' : 'var(--text-muted)' }}>
                      {importStatus}
                    </span>
                  )}
                </div>
              </Section>

              <div
                className="px-4 py-3 rounded-xl text-xs"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}
              >
                <strong style={{ color: 'var(--text-secondary)' }}>Importing from Claude.ai</strong>
                <ol className="mt-2 space-y-1 list-decimal list-inside">
                  <li>Go to claude.ai/settings</li>
                  <li>Click "Export Data" and download your archive</li>
                  <li>Unzip and find <code style={{ color: 'var(--text-secondary)' }}>conversations.json</code></li>
                  <li>Use the import button above to load it</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2">
        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</div>
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="px-4 py-3 rounded-xl"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
    >
      <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
