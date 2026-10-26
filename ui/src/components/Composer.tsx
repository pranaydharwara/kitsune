import { createPortal } from 'react-dom';
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
  const [menuPos, setMenuPos] = useState<{ left: number; bottom: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        const clickedButton = Object.values(buttonRefs.current).some(
          (btn) => btn && btn.contains(e.target as Node)
        );
        if (!clickedButton) {
          setOpenMenu(null);
        }
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
      return;
    }
    const btn = buttonRefs.current[m];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setMenuPos({ left: rect.left, bottom: window.innerHeight - rect.top + 4 });
    }
    setOpenMenu(m);
  };

  const handleModelSelect = (modeVal: string, modelId: string | null) => {
    onSelect(modeVal, modelId);
    setOpenMenu(null);
  };

  const activeModels = openMenu === 'local' ? localModels : openMenu === 'cloud' ? cloudModels : [];

  return (
    <div className="px-6 pb-5 pt-2">
      <div
        className="max-w-[720px] mx-auto rounded-2xl"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
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
          className="w-full resize-none bg-transparent px-4 pt-3 pb-1 outline-none placeholder:text-[var(--text-muted)]"
          style={{ color: 'var(--text-primary)', minHeight: '44px', fontSize: '15px', lineHeight: '1.47', letterSpacing: '-0.022em' }}
        />
        <div className="flex items-center justify-between px-3 pb-2.5">
          <div className="flex items-center gap-1">
            {(['auto', 'local', 'cloud'] as const).map((m) => (
              <button
                key={m}
                ref={(el) => { buttonRefs.current[m] = el; }}
                onClick={() => handleModeClick(m)}
                className="flex items-center gap-0.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer active:scale-[0.95]"
                style={{
                  background: mode === m ? 'var(--bg-primary)' : 'transparent',
                  color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: mode === m ? '1px solid var(--border-light)' : '1px solid transparent',
                  fontSize: '12px',
                  letterSpacing: '-0.01em',
                }}
              >
                {modeLabel(m)}
                {hasDropdown(m) && <ChevronDown size={10} style={{ marginLeft: 2, opacity: 0.5 }} />}
              </button>
            ))}
            <span className="text-xs ml-1.5" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>⌘/</span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!text.trim() || disabled}
            className="p-1.5 rounded-full transition-all cursor-pointer disabled:opacity-25 active:scale-[0.9]"
            style={{ background: text.trim() ? 'var(--accent)' : 'var(--border)', color: '#fff' }}
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {openMenu && activeModels.length > 0 && menuPos && createPortal(
        <div ref={menuRef}>
          <ModelMenu
            models={activeModels}
            selectedModel={selectedModel}
            mode={openMenu}
            onSelect={handleModelSelect}
            groupBy={openMenu === 'cloud' ? 'family' : undefined}
            position={menuPos}
            renderItem={openMenu === 'local' ? (model) => (
              <div className="flex items-center justify-between gap-3">
                <span>{model.name}</span>
                {model.size && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{model.size}</span>
                )}
              </div>
            ) : undefined}
          />
        </div>,
        document.body
      )}
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
  position,
}: {
  models: ModelItem[];
  selectedModel: string | null;
  mode: string;
  onSelect: (mode: string, model: string | null) => void;
  groupBy?: string;
  renderItem?: (model: ModelItem) => React.ReactNode;
  position: { left: number; bottom: number };
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
      className="py-1.5 rounded-xl min-w-[200px]"
      style={{
        position: 'fixed',
        left: position.left,
        bottom: position.bottom,
        zIndex: 9999,
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-light)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
      }}
    >
      <button
        onClick={() => onSelect(mode, null)}
        className="w-full text-left px-3.5 py-2 text-xs transition-all cursor-pointer"
        style={{
          color: selectedModel === null ? 'var(--accent)' : 'var(--text-secondary)',
          background: 'transparent',
          fontSize: '13px',
        }}
      >
        Auto (best available)
      </button>
      <div className="mx-3 my-1" style={{ borderTop: '1px solid var(--border-light)' }} />
      {Object.entries(grouped).map(([group, items]) => (
        <div key={group}>
          {group && (
            <div className="px-3.5 py-1 text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>
              {group}
            </div>
          )}
          {items.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelect(mode, m.id)}
              className="w-full text-left px-3.5 py-2 transition-all cursor-pointer"
              style={{
                color: selectedModel === m.id ? 'var(--accent)' : 'var(--text-primary)',
                background: 'transparent',
                fontSize: '13px',
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
