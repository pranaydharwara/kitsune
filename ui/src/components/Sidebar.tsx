import { useState } from 'react';
import { ChevronDown, ChevronRight, FolderPlus, Plus, Search, Settings, Trash2, X } from 'lucide-react';
import type { Conversation, Project } from '../lib/api';

interface SidebarProps {
  conversations: Conversation[];
  projects: Project[];
  activeId: string | null;
  activeProjectId: string | null;
  addingProject: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
  onAddProject: () => void;
  onAddProjectPath: (path: string) => void;
  onCancelAddProject: () => void;
  onDeleteProject: (id: string) => void;
  onSelectProject: (id: string | null) => void;
}

export function Sidebar({
  conversations,
  projects,
  activeId,
  activeProjectId,
  addingProject,
  onSelect,
  onNew,
  onDelete,
  onOpenSettings,
  onAddProject,
  onAddProjectPath,
  onCancelAddProject,
  onDeleteProject,
  onSelectProject,
}: SidebarProps) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = query
    ? conversations.filter(
        (c) =>
          c.title.toLowerCase().includes(query.toLowerCase()) ||
          c.last_message?.toLowerCase().includes(query.toLowerCase()),
      )
    : conversations;

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Group conversations by project
  const grouped: Record<string, Conversation[]> = {};
  const ungrouped: Conversation[] = [];
  for (const conv of filtered) {
    if (conv.project_id) {
      (grouped[conv.project_id] ??= []).push(conv);
    } else {
      ungrouped.push(conv);
    }
  }

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
          style={{
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-light)',
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
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
            <button onClick={() => setQuery('')} className="cursor-pointer" style={{ color: 'var(--text-muted)' }}>
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {/* Project sections */}
        {projects.map((project) => {
          const projectConvs = grouped[project.id] || [];
          const isCollapsed = collapsed[project.id] ?? false;
          const isActive = activeProjectId === project.id;

          return (
            <div key={project.id} className="mb-1">
              <div
                className="group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-xs transition-all"
                style={{
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  background: isActive ? 'var(--surface-hover)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                }}
                onClick={() => {
                  if (isActive) {
                    toggleCollapse(project.id);
                  } else {
                    onSelectProject(project.id);
                    if (isCollapsed) toggleCollapse(project.id);
                  }
                }}
              >
                {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                <span className="truncate flex-1" title={project.path}>
                  {project.name}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}
                >
                  {projectConvs.length}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteProject(project.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded cursor-pointer"
                  style={{ color: 'var(--text-muted)' }}
                  title="Remove project"
                >
                  <Trash2 size={11} />
                </button>
              </div>
              {!isCollapsed && (
                <div className="ml-3">
                  {projectConvs.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conv={conv}
                      isActive={conv.id === activeId}
                      onSelect={onSelect}
                      onDelete={onDelete}
                    />
                  ))}
                  {projectConvs.length === 0 && !query && (
                    <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      No chats yet
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add project */}
        {addingProject ? (
          <div className="px-2 mb-2">
            <input
              autoFocus
              type="text"
              placeholder="Enter folder path..."
              className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-transparent outline-none"
              style={{ color: 'var(--text-primary)', border: '1px solid var(--accent)' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onAddProjectPath((e.target as HTMLInputElement).value);
                if (e.key === 'Escape') onCancelAddProject();
              }}
              onBlur={(e) => {
                if (e.target.value.trim()) onAddProjectPath(e.target.value);
                else onCancelAddProject();
              }}
            />
          </div>
        ) : (
          <button
            onClick={onAddProject}
            className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer active:scale-[0.97] mb-2"
            style={{ color: 'var(--text-muted)' }}
          >
            <FolderPlus size={13} />
            Add project
          </button>
        )}

        {/* Ungrouped conversations */}
        {ungrouped.length > 0 && (
          <>
            {projects.length > 0 && (
              <div
                className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider mt-1 mb-0.5"
                style={{ color: 'var(--text-muted)' }}
              >
                Chats
              </div>
            )}
            {ungrouped.map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                isActive={conv.id === activeId}
                onSelect={onSelect}
                onDelete={onDelete}
              />
            ))}
          </>
        )}

        {query && filtered.length === 0 && (
          <div className="px-3 py-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No chats found
          </div>
        )}
      </div>

      <div className="p-3" style={{ borderTop: '1px solid var(--border-light)' }}>
        <div className="flex items-center gap-2 px-3 py-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          <svg width="18" height="18" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <rect width="512" height="512" rx="112" fill="#1d1d1f" />
            <path d="M108 340 L168 88 L256 280 Z" fill="#FF7A3D" />
            <path d="M404 340 L344 88 L256 280 Z" fill="#FF7A3D" />
            <path d="M148 310 L178 130 L240 270 Z" fill="#E8531B" />
            <path d="M364 310 L334 130 L272 270 Z" fill="#E8531B" />
            <ellipse cx="256" cy="340" rx="120" ry="105" fill="white" />
            <circle cx="210" cy="310" r="18" fill="#1d1d1f" />
            <circle cx="302" cy="310" r="18" fill="#1d1d1f" />
            <circle cx="218" cy="302" r="6" fill="white" />
            <circle cx="310" cy="302" r="6" fill="white" />
            <ellipse cx="256" cy="360" rx="14" ry="10" fill="#1d1d1f" />
            <path d="M242 370 Q256 385 270 370" fill="none" stroke="#1d1d1f" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
          <span className="font-medium" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Kitsune
          </span>
          <button
            onClick={onOpenSettings}
            className="ml-auto p-1.5 rounded-lg cursor-pointer transition-all active:scale-[0.9]"
            style={{ color: 'var(--text-muted)' }}
          >
            <Settings size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function ConversationItem({
  conv,
  isActive,
  onSelect,
  onDelete,
}: {
  conv: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      onClick={() => onSelect(conv.id)}
      className="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm mb-0.5 transition-all"
      style={{
        background: isActive ? 'var(--surface-hover)' : 'transparent',
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontWeight: isActive ? 500 : 400,
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
  );
}
