import { Plus, Trash2 } from 'lucide-react';
import type { Conversation } from '../lib/api';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function Sidebar({ conversations, activeId, onSelect, onNew, onDelete }: SidebarProps) {
  return (
    <aside
      className="flex flex-col h-screen w-[260px] shrink-0"
      style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-light)' }}
    >
      <div
        data-tauri-drag-region="true"
        className="p-3 pt-10"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <button
          onClick={onNew}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer active:scale-[0.97]"
          style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <Plus size={15} strokeWidth={2} />
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm mb-0.5 transition-all"
            style={{
              background: conv.id === activeId ? 'var(--surface-hover)' : 'transparent',
              color: conv.id === activeId ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: conv.id === activeId ? 500 : 400,
            }}
          >
            <span className="truncate flex-1">{conv.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <div className="p-3" style={{ borderTop: '1px solid var(--border-light)' }}>
        <div className="flex items-center gap-2 px-3 py-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '16px' }}>🦊</span>
          <span className="font-medium" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Kitsune</span>
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>v0.1</span>
        </div>
      </div>
    </aside>
  );
}
