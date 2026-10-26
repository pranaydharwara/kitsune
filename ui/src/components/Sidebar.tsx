import { useState } from 'react';
import { Plus, Search, Trash2, X } from 'lucide-react';
import type { Conversation } from '../lib/api';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function Sidebar({ conversations, activeId, onSelect, onNew, onDelete }: SidebarProps) {
  const [query, setQuery] = useState('');

  const filtered = query
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        c.last_message?.toLowerCase().includes(query.toLowerCase())
      )
    : conversations;

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

      <div className="px-3 pb-2">
        <div
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm"
          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {filtered.map((conv) => (
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
        {query && filtered.length === 0 && (
          <div className="px-3 py-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No chats found
          </div>
        )}
      </div>

      <div className="p-3" style={{ borderTop: '1px solid var(--border-light)' }}>
        <div className="flex items-center gap-2 px-3 py-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          <svg width="18" height="18" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <rect width="512" height="512" rx="112" fill="#1d1d1f"/>
            <path d="M108 340 L168 88 L256 280 Z" fill="#FF7A3D"/>
            <path d="M404 340 L344 88 L256 280 Z" fill="#FF7A3D"/>
            <path d="M148 310 L178 130 L240 270 Z" fill="#E8531B"/>
            <path d="M364 310 L334 130 L272 270 Z" fill="#E8531B"/>
            <ellipse cx="256" cy="340" rx="120" ry="105" fill="white"/>
            <circle cx="210" cy="310" r="18" fill="#1d1d1f"/>
            <circle cx="302" cy="310" r="18" fill="#1d1d1f"/>
            <circle cx="218" cy="302" r="6" fill="white"/>
            <circle cx="310" cy="302" r="6" fill="white"/>
            <ellipse cx="256" cy="360" rx="14" ry="10" fill="#1d1d1f"/>
            <path d="M242 370 Q256 385 270 370" fill="none" stroke="#1d1d1f" strokeWidth="3.5" strokeLinecap="round"/>
          </svg>
          <span className="font-medium" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Kitsune</span>
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>v0.1</span>
        </div>
      </div>
    </aside>
  );
}
