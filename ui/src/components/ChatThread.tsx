import { useEffect, useRef } from 'react';
import type { Message } from '../lib/api';

interface ChatThreadProps {
  messages: Message[];
  streamingText: string;
  isStreaming: boolean;
  error: string | null;
}

export function ChatThread({ messages, streamingText, isStreaming, error }: ChatThreadProps) {
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
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isStreaming && (
          <div className="mb-6">
            <div className="py-3">
              <div className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)', lineHeight: '1.7' }}>
                {streamingText || ''}
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

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`mb-6 ${isUser ? 'flex justify-end' : ''}`}>
      <div
        className={`py-3 ${isUser ? 'px-4 rounded-2xl max-w-[85%]' : ''}`}
        style={isUser ? { background: 'var(--msg-user-bg)' } : {}}
      >
        <div className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)', lineHeight: '1.7' }}>
          {message.text}
        </div>
      </div>
      {!isUser && message.answered_by && (
        <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {formatModelBadge(message.answered_by, message.latency_ms)}
        </div>
      )}
    </div>
  );
}

function formatModelBadge(answeredBy: string, latencyMs?: number): string {
  const parts = answeredBy.split(':');
  const source = parts[0] === 'local' ? 'Local' : 'Claude';
  const model = parts[1] || '';
  const latency = latencyMs ? ` · ${(latencyMs / 1000).toFixed(1)}s` : '';
  return `${source} · ${model}${latency}`;
}
