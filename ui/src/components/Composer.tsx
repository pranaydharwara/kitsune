import { ArrowUp, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ModelsResponse } from '../lib/api';

interface ComposerProps {
  onSend: (message: string) => void;
  disabled: boolean;
  mode: string;
  selectedModel: string | null;
  onSelect: (mode: string, model: string | null) => void;
  models: ModelsResponse;
}

export function Composer({ onSend, disabled, mode, selectedModel, onSelect, models }: ComposerProps) {
  const [text, setText] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const modes = ['auto', 'local', 'cloud'] as const;
      const idx = modes.indexOf(mode as typeof modes[number]);
      onSelect(modes[(idx + 1) % modes.length], null);
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  };

  const localModels = models.local || [];
  const cloudModels = models.cloud || [];

  const selectedModelName = (): string | null => {
    if (!selectedModel) return null;
    for (const m of localModels) { if (m.id === selectedModel) return m.name; }
    for (const m of cloudModels) { if (m.id === selectedModel) return m.name; }
    return null;
  };

  const modeLabel = (m: string): string => {
    if (m === 'auto') return 'Auto';
    if (m === mode && selectedModel) {
      const name = selectedModelName();
      if (name) return name;
    }
    if (m === 'local') return 'Local';
    return 'Cloud';
  };

  const hasDropdown = (m: string) => m === 'local' || m === 'cloud';

  const handleModeClick = (m: string) => {
    if (m === 'auto') {
      onSelect('auto', null);
      setOpenMenu(null);
      return;
    }
    if (openMenu === m) {
      setOpenMenu(null);
    } else {
      setOpenMenu(m);
    }
  };

  const handleModelSelect = (modeVal: string, modelId: string | null) => {
    onSelect(modeVal, modelId);
    setOpenMenu(null);
  };

  return (
    <div className="px-6 pb-4 pt-2">
      <div
        className="max-w-[760px] mx-auto rounded-2xl overflow-visible"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Message Kitsune..."
          disabled={disabled}
          rows={1}
          className="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm outline-none placeholder:text-[var(--text-muted)]"
          style={{ color: 'var(--text-primary)', minHeight: '44px' }}
        />
        <div className="flex items-center justify-between px-3 pb-2">
          <div className="flex items-center gap-1" ref={menuRef}>
            {(['auto', 'local', 'cloud'] as const).map((m) => (
              <div key={m} className="relative">
                <button
                  onClick={() => handleModeClick(m)}
                  className="flex items-center gap-0.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer"
                  style={{
                    background: mode === m ? 'var(--bg-primary)' : 'transparent',
                    color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                    border: mode === m ? '1px solid var(--border)' : '1px solid transparent',
                  }}
                >
                  {modeLabel(m)}
                  {hasDropdown(m) && <ChevronDown size={10} style={{ marginLeft: 2, opacity: 0.5 }} />}
                </button>

                {openMenu === m && m === 'local' && localModels.length > 0 && (
                  <ModelMenu
                    models={localModels}
                    selectedModel={selectedModel}
                    mode="local"
                    onSelect={handleModelSelect}
                    renderItem={(model) => (
                      <div className="flex items-center justify-between gap-3">
                        <span>{model.name}</span>
                        {model.size && (
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{model.size}</span>
                        )}
                      </div>
                    )}
                  />
                )}

                {openMenu === m && m === 'cloud' && cloudModels.length > 0 && (
                  <ModelMenu
                    models={cloudModels}
                    selectedModel={selectedModel}
                    mode="cloud"
                    onSelect={handleModelSelect}
                    groupBy="family"
                  />
                )}
              </div>
            ))}
            <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>⌘/</span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!text.trim() || disabled}
            className="p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-30"
            style={{ background: text.trim() ? 'var(--kitsune-orange)' : 'var(--border)', color: '#fff' }}
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

interface ModelItem {
  id: string;
  name: string;
  size?: string;
  family?: string;
}

function ModelMenu({
  models,
  selectedModel,
  mode,
  onSelect,
  groupBy,
  renderItem,
}: {
  models: ModelItem[];
  selectedModel: string | null;
  mode: string;
  onSelect: (mode: string, model: string | null) => void;
  groupBy?: string;
  renderItem?: (model: ModelItem) => React.ReactNode;
}) {
  const grouped = groupBy
    ? models.reduce<Record<string, ModelItem[]>>((acc, m) => {
        const key = (m as unknown as Record<string, string>)[groupBy] || '';
        if (!acc[key]) acc[key] = [];
        acc[key].push(m);
        return acc;
      }, {})
    : { '': models };

  return (
    <div
      className="absolute bottom-full left-0 mb-1 py-1 rounded-lg shadow-lg min-w-[180px] z-50"
      style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
    >
      <button
        onClick={() => onSelect(mode, null)}
        className="w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer hover:opacity-80"
        style={{
          color: selectedModel === null ? 'var(--kitsune-orange)' : 'var(--text-secondary)',
          background: 'transparent',
        }}
      >
        Auto (best available)
      </button>
      <div className="mx-2 my-0.5" style={{ borderTop: '1px solid var(--border-light)' }} />
      {Object.entries(grouped).map(([group, items]) => (
        <div key={group}>
          {group && (
            <div className="px-3 py-1 text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {group}
            </div>
          )}
          {items.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelect(mode, m.id)}
              className="w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer hover:opacity-80"
              style={{
                color: selectedModel === m.id ? 'var(--kitsune-orange)' : 'var(--text-primary)',
                background: 'transparent',
              }}
            >
              {renderItem ? renderItem(m) : m.name}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
