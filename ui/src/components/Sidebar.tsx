import { MessageSquarePlus, Trash2 } from 'lucide-react';
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
      style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}
    >
      {/* New chat button */}
      <div className="p-3">
        <button
          onClick={onNew}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
        >
          <MessageSquarePlus size={16} />
          New chat
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-2">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm mb-0.5 transition-colors"
            style={{
              background: conv.id === activeId ? 'var(--bg-primary)' : 'transparent',
              color: conv.id === activeId ? 'var(--text-primary)' : 'var(--text-secondary)',
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
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '18px' }}>🦊</span>
          <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Kitsune</span>
          <span className="text-xs ml-auto">v0.1</span>
        </div>
      </div>
    </aside>
  );
}
