import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, RouteInfo } from '../lib/api';
import { getContextSnapshot } from '../lib/api';

interface ChatThreadProps {
  messages: Message[];
  streamingText: string;
  isStreaming: boolean;
  error: string | null;
  routeInfo: RouteInfo | null;
  onRetry: (messageId: string, retryWith: 'local' | 'cloud') => void;
}

export function ChatThread({ messages, streamingText, isStreaming, error, routeInfo, onRetry }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <span className="text-5xl">🦊</span>
        <h2 className="text-xl font-medium" style={{ color: 'var(--text-primary)' }}>
          What can I help with?
        </h2>
        <div className="flex gap-2 flex-wrap justify-center max-w-md">
          {['What PRs need my review?', 'Explain this error', 'Draft a commit message', 'Help me debug'].map((s) => (
            <span
              key={s}
              className="px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[760px] mx-auto px-6 py-6">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} onRetry={onRetry} />
        ))}
        {isStreaming && (
          <div className="mb-6">
            {routeInfo && (
              <div className="mb-2">
                <RouteBadge route={routeInfo} />
              </div>
            )}
            <div className="py-3">
              <div className="markdown-body text-sm" style={{ color: 'var(--text-primary)', lineHeight: '1.7' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText || ''}</ReactMarkdown>
                <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded-sm" style={{ background: 'var(--kitsune-orange)' }} />
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg text-sm" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function RouteBadge({ route }: { route: RouteInfo }) {
  const isCloud = route.source.startsWith('claude');
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
      style={{
        background: isCloud ? '#EDE9FE' : '#F0FDF4',
        color: isCloud ? '#6D28D9' : '#166534',
      }}
      title={route.reason}
    >
      {isCloud ? '☁️' : '💻'} {route.reason}
    </span>
  );
}

function MessageBubble({ message, onRetry }: { message: Message; onRetry: (id: string, retryWith: 'local' | 'cloud') => void }) {
  const isUser = message.role === 'user';
  const isCloud = message.answered_by?.startsWith('claude');
  const isLocal = message.answered_by?.startsWith('local');

  return (
    <div className={`mb-6 ${isUser ? 'flex justify-end' : ''}`}>
      <div
        className={`py-3 ${isUser ? 'px-4 rounded-2xl max-w-[85%]' : ''}`}
        style={isUser ? { background: 'var(--msg-user-bg)' } : {}}
      >
        {isUser ? (
          <div className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)', lineHeight: '1.7' }}>
            {message.text}
          </div>
        ) : (
          <div className="markdown-body text-sm" style={{ color: 'var(--text-primary)', lineHeight: '1.7' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
          </div>
        )}
      </div>
      {!isUser && message.answered_by && (
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {formatModelBadge(message.answered_by, message.latency_ms)}
          </span>
          {isLocal && (
            <button
              onClick={() => onRetry(message.id, 'cloud')}
              className="text-xs px-2 py-0.5 rounded-md transition-colors cursor-pointer"
              style={{ color: '#6D28D9', background: '#EDE9FE' }}
            >
              Retry with Claude
            </button>
          )}
          {isCloud && (
            <button
              onClick={() => onRetry(message.id, 'local')}
              className="text-xs px-2 py-0.5 rounded-md transition-colors cursor-pointer"
              style={{ color: '#166534', background: '#F0FDF4' }}
            >
              Retry locally
            </button>
          )}
          {isCloud && <InspectorLink messageId={message.id} />}
        </div>
      )}
    </div>
  );
}

function InspectorLink({ messageId }: { messageId: string }) {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<{ prompt_text: string | null; token_estimate: number | null } | null>(null);

  const handleClick = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    const data = await getContextSnapshot(messageId);
    setSnapshot(data);
    setOpen(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="text-xs px-2 py-0.5 rounded-md transition-colors cursor-pointer"
        style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}
      >
        What was sent
      </button>
      {open && snapshot?.prompt_text && (
        <div
          className="mt-2 w-full p-3 rounded-lg text-xs font-mono overflow-auto max-h-64"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
        >
          <div className="mb-2 font-sans" style={{ color: 'var(--text-muted)' }}>
            ~{snapshot.token_estimate?.toLocaleString()} tokens sent to Claude
          </div>
          <pre className="whitespace-pre-wrap">{snapshot.prompt_text}</pre>
        </div>
      )}
    </>
  );
}

function formatModelBadge(answeredBy: string, latencyMs?: number): string {
  const parts = answeredBy.split(':');
  const source = parts[0] === 'local' ? 'Local' : 'Claude';
  const model = parts[1] || '';
  const latency = latencyMs ? ` · ${(latencyMs / 1000).toFixed(1)}s` : '';
  return `${source} · ${model}${latency}`;
}
