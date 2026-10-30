import { useEffect, useRef, useState } from 'react';
import { FileText, Folder, AlertCircle, AtSign } from 'lucide-react';
import type { MentionCompletion } from '../lib/api';
import { getMentionCompletions } from '../lib/api';

interface MentionMenuProps {
  query: string;
  projectId: string | null;
  position: { left: number; bottom: number };
  onSelect: (value: string) => void;
  onClose: () => void;
}

const TYPE_ICONS: Record<string, typeof FileText> = {
  file: FileText,
  folder: Folder,
  keyword: AtSign,
};

export function MentionMenu({ query, projectId, position, onSelect, onClose }: MentionMenuProps) {
  const [completions, setCompletions] = useState<MentionCompletion[]>([]);
  const [selected, setSelected] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await getMentionCompletions(query, projectId || undefined);
        setCompletions(res.completions || []);
        setSelected(0);
      } catch {
        setCompletions([]);
      }
    }, 150);
    return () => clearTimeout(debounceRef.current);
  }, [query, projectId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, completions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (completions[selected]) {
          onSelect(completions[selected].value);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [completions, selected, onSelect, onClose]);

  if (completions.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="py-1.5 rounded-xl min-w-[280px] max-w-[400px] max-h-[240px] overflow-y-auto"
      style={{
        position: 'fixed',
        left: Math.min(position.left, window.innerWidth - 420),
        bottom: position.bottom,
        zIndex: 9999,
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-light)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)',
      }}
    >
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        Mentions
      </div>
      {completions.map((c, i) => {
        const Icon = TYPE_ICONS[c.type] || AlertCircle;
        return (
          <button
            key={c.value}
            onClick={() => onSelect(c.value)}
            className="w-full text-left px-3 py-2 flex items-center gap-2.5 transition-all cursor-pointer"
            style={{
              background: i === selected ? 'var(--surface-hover)' : 'transparent',
              color: 'var(--text-primary)',
            }}
          >
            <Icon size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] truncate">{c.label}</div>
              {c.detail && (
                <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{c.detail}</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
