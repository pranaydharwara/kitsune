import { useState } from 'react';
import { FileText, Folder, AlertCircle, BookOpen, ChevronDown, ChevronRight, X, Layers } from 'lucide-react';
import type { MentionContext } from '../lib/api';

interface ContextPanelProps {
  data: MentionContext | null;
  open: boolean;
  onClose: () => void;
}

export function ContextPanel({ data, open, onClose }: ContextPanelProps) {
  if (!open || !data) return null;

  const items = data.items || [];

  return (
    <aside
      className="flex flex-col h-screen w-[380px] shrink-0"
      style={{ background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border-light)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 pt-12"
        style={{ borderBottom: '1px solid var(--border-light)' }}
      >
        <div className="flex items-center gap-2">
          <Layers size={14} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Context
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}
          >
            {items.filter(i => i.status === 'ok').length} loaded
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg cursor-pointer transition-all active:scale-[0.9]"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {data.instructions && (
          <ContextCard
            icon={BookOpen}
            title="Project Instructions"
            subtitle=".kitsune.md"
            content={data.instructions}
            status="ok"
          />
        )}

        {items.map((item, i) => {
          const icon = item.type === 'file' ? FileText : item.type === 'folder' ? Folder : AlertCircle;
          const title = `@${item.type}${item.arg ? ' ' + item.arg : ''}`;

          return (
            <ContextCard
              key={i}
              icon={icon}
              title={title}
              content={item.content || ''}
              status={item.status}
            />
          );
        })}
      </div>
    </aside>
  );
}

function ContextCard({
  icon: Icon,
  title,
  subtitle,
  content,
  status,
}: {
  icon: typeof FileText;
  title: string;
  subtitle?: string;
  content: string;
  status: 'ok' | 'not_found';
}) {
  const [expanded, setExpanded] = useState(true);
  const isError = status === 'not_found';

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: 'var(--bg-primary)',
        border: `1px solid ${isError ? '#d6303130' : 'var(--border-light)'}`,
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2.5 text-left cursor-pointer"
        style={{ background: 'transparent' }}
      >
        <Icon size={13} style={{ color: isError ? '#d63031' : 'var(--accent)' }} />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium truncate block" style={{ color: 'var(--text-primary)' }}>
            {title}
          </span>
          {subtitle && (
            <span className="text-[10px] truncate block" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </span>
          )}
        </div>
        {isError && (
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: '#d63031', background: '#d6303110' }}>
            not found
          </span>
        )}
        {expanded ? (
          <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
        ) : (
          <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
        )}
      </button>

      {expanded && content && (
        <div
          className="px-3 pb-3"
          style={{ borderTop: '1px solid var(--border-light)' }}
        >
          <pre
            className="mt-2 text-[11px] p-2 rounded-md overflow-auto max-h-[300px]"
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}
