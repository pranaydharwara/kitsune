import { ArrowUp } from 'lucide-react';
import { useRef, useState } from 'react';

interface ComposerProps {
  onSend: (message: string) => void;
  disabled: boolean;
  mode: string;
  onModeChange: (mode: string) => void;
}

const MODES = ['auto', 'local', 'cloud'] as const;
const MODE_LABELS: Record<string, string> = {
  auto: 'Auto',
  local: 'Local only',
  cloud: 'Cloud',
};

export function Composer({ onSend, disabled, mode, onModeChange }: ComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const idx = MODES.indexOf(mode as typeof MODES[number]);
      onModeChange(MODES[(idx + 1) % MODES.length]);
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  };

  return (
    <div className="px-6 pb-4 pt-2">
      <div
        className="max-w-[760px] mx-auto rounded-2xl overflow-hidden"
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
          {/* Mode toggle */}
          <div className="flex items-center gap-1">
            {MODES.map((m) => (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer"
                style={{
                  background: mode === m ? 'var(--bg-primary)' : 'transparent',
                  color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: mode === m ? '1px solid var(--border)' : '1px solid transparent',
                }}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
            <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>⌘/</span>
          </div>

          {/* Send button */}
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
