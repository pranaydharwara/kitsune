import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, FileText, Terminal, FolderOpen, Eye, Loader2, X, AlertCircle } from 'lucide-react';
import type { ToolUseEvent } from '../lib/api';

interface ToolActivityProps {
  events: ToolUseEvent[];
  open: boolean;
  onClose: () => void;
}

const TOOL_META: Record<string, { icon: typeof Terminal; label: string; verb: string }> = {
  create_file: { icon: FileText, label: 'Create File', verb: 'Created' },
  read_file: { icon: Eye, label: 'Read File', verb: 'Read' },
  list_files: { icon: FolderOpen, label: 'List Files', verb: 'Listed' },
  run_command: { icon: Terminal, label: 'Run Command', verb: 'Ran' },
};

export function ToolActivity({ events, open, onClose }: ToolActivityProps) {
  if (!open || events.length === 0) return null;

  return (
    <aside
      className="flex flex-col h-screen w-[340px] shrink-0"
      style={{ background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border-light)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 pt-12"
        style={{ borderBottom: '1px solid var(--border-light)' }}
      >
        <div className="flex items-center gap-2">
          <Terminal size={14} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Tool Activity
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}
          >
            {events.length}
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
        {events.map((evt, i) => (
          <ToolEventCard key={i} event={evt} index={i} />
        ))}
      </div>
    </aside>
  );
}

function ToolEventCard({ event, index }: { event: ToolUseEvent; index: number }) {
  const [expanded, setExpanded] = useState(true);
  const meta = TOOL_META[event.tool] || { icon: Terminal, label: event.tool, verb: event.tool };
  const Icon = meta.icon;
  const isRunning = event.status === 'running';
  const isDone = event.status === 'done';
  const hasError = isDone && event.result && 'error' in event.result;

  const detail = _getDetail(event);
  const resultContent = _getResultContent(event);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: 'var(--bg-primary)',
        border: `1px solid ${hasError ? '#d6303130' : 'var(--border-light)'}`,
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2.5 text-left cursor-pointer"
        style={{ background: 'transparent' }}
      >
        {isRunning ? (
          <Loader2 size={13} className="animate-spin" style={{ color: 'var(--accent)' }} />
        ) : hasError ? (
          <AlertCircle size={13} style={{ color: '#d63031' }} />
        ) : (
          <Icon size={13} style={{ color: 'var(--accent)' }} />
        )}
        <span className="flex-1 text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {isRunning ? meta.label : meta.verb}
          {detail && (
            <code
              className="ml-1.5 px-1 py-0.5 rounded text-[11px] font-normal"
              style={{ background: 'var(--surface-hover)', fontFamily: 'monospace' }}
            >
              {detail}
            </code>
          )}
        </span>
        {isDone && !hasError && <Check size={12} style={{ color: 'var(--accent)' }} />}
        {expanded ? <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
      </button>

      {expanded && (
        <div
          className="px-3 pb-3"
          style={{ borderTop: '1px solid var(--border-light)' }}
        >
          {event.tool === 'create_file' && event.arguments.content && (
            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                Content
              </div>
              <pre
                className="text-[11px] p-2 rounded-md overflow-auto max-h-[200px]"
                style={{
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {String(event.arguments.content).slice(0, 3000)}
              </pre>
            </div>
          )}

          {event.tool === 'run_command' && event.arguments.command && (
            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                Command
              </div>
              <pre
                className="text-[11px] p-2 rounded-md overflow-auto"
                style={{
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                }}
              >
                $ {String(event.arguments.command)}
              </pre>
            </div>
          )}

          {resultContent && (
            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: hasError ? '#d63031' : 'var(--text-muted)' }}>
                {hasError ? 'Error' : 'Result'}
              </div>
              <pre
                className="text-[11px] p-2 rounded-md overflow-auto max-h-[200px]"
                style={{
                  background: hasError ? '#d6303108' : 'var(--bg-secondary)',
                  color: hasError ? '#d63031' : 'var(--text-secondary)',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {resultContent}
              </pre>
            </div>
          )}

          {isRunning && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <Loader2 size={10} className="animate-spin" />
              Executing...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function _getDetail(event: ToolUseEvent): string {
  if (event.tool === 'create_file' || event.tool === 'read_file') {
    return (event.arguments.path as string) || '';
  }
  if (event.tool === 'list_files') {
    return (event.arguments.path as string) || '.';
  }
  if (event.tool === 'run_command') {
    const cmd = (event.arguments.command as string) || '';
    return cmd.length > 40 ? cmd.slice(0, 37) + '...' : cmd;
  }
  return '';
}

function _getResultContent(event: ToolUseEvent): string | null {
  if (event.status !== 'done' || !event.result) return null;

  if ('error' in event.result) {
    return String(event.result.error);
  }

  if (event.tool === 'run_command' && event.result.output) {
    const out = String(event.result.output);
    const code = event.result.exit_code;
    const prefix = code !== 0 ? `Exit code: ${code}\n` : '';
    return prefix + out.slice(0, 3000);
  }

  if (event.tool === 'read_file' && event.result.content) {
    return String(event.result.content).slice(0, 3000);
  }

  if (event.tool === 'list_files' && event.result.entries) {
    return (event.result.entries as string[]).join('\n');
  }

  if (event.tool === 'create_file' && event.result.success) {
    return `Created (${event.result.size} bytes)`;
  }

  return null;
}
