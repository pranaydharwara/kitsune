import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
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
  speed: number | null;
  onRetry: (messageId: string, retryWith: 'local' | 'cloud') => void;
}

export function ChatThread({ messages, streamingText, isStreaming, error, routeInfo, speed: _speed, onRetry }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5">
        <svg width="64" height="64" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
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
        <h2
          className="text-xl"
          style={{
            color: 'var(--text-primary)',
            fontWeight: 600,
            letterSpacing: '-0.022em',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
          }}
        >
          What can I help with?
        </h2>
        <div className="flex gap-2 flex-wrap justify-center max-w-md">
          {['Summarise this article for me', 'Help me write an email', 'Explain a concept simply', 'Brainstorm ideas with me'].map((s) => (
            <span
              key={s}
              className="px-3.5 py-1.5 rounded-full text-[13px] cursor-pointer transition-all active:scale-[0.97]"
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-light)',
              }}
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
      <div className="max-w-[720px] mx-auto px-6 py-8">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} onRetry={onRetry} />
        ))}
        {isStreaming && (
          <div className="mb-8">
            {routeInfo && (
              <div className="mb-2">
                <RouteBadge route={routeInfo} />
              </div>
            )}
            <div className="py-3">
              <div className="markdown-body" style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: '1.6' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText || ''}</ReactMarkdown>
                <span
                  className="inline-block w-[3px] h-[18px] ml-0.5 animate-pulse rounded-full"
                  style={{ background: 'var(--accent)' }}
                />
              </div>
            </div>
          </div>
        )}
        {error && (
          <div
            className="mb-8 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'var(--bg-secondary)', color: '#d63031', border: '1px solid var(--border-light)' }}
          >
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
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
      style={{
        background: 'var(--bg-secondary)',
        color: 'var(--text-muted)',
        border: '1px solid var(--border-light)',
      }}
    >
      {isCloud ? '☁️' : '💻'} {route.reason}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-lg cursor-pointer transition-all active:scale-[0.9] opacity-0 group-hover:opacity-100"
      style={{ color: 'var(--text-muted)' }}
      title="Copy message"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function MessageBubble({ message, onRetry }: { message: Message; onRetry: (id: string, retryWith: 'local' | 'cloud') => void }) {
  const isUser = message.role === 'user';
  const isCloud = message.answered_by?.startsWith('claude');
  const isLocal = message.answered_by?.startsWith('local');

  return (
    <div className={`group mb-8 ${isUser ? 'flex justify-end' : ''}`}>
      <div
        className={`py-3 ${isUser ? 'px-4 rounded-2xl max-w-[85%]' : ''}`}
        style={isUser ? { background: 'var(--msg-user-bg)' } : {}}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap" style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: '1.6' }}>
            {message.text}
          </div>
        ) : (
          <div className="markdown-body" style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: '1.6' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
          </div>
        )}
      </div>
      {!isUser && message.answered_by && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            {formatModelBadge(message.answered_by, message.latency_ms, message.tokens_in, message.tokens_out)}
          </span>
          <CopyButton text={message.text} />
          {isLocal && (
            <button
              onClick={() => onRetry(message.id, 'cloud')}
              className="text-xs px-2.5 py-1 rounded-full transition-all cursor-pointer active:scale-[0.95]"
              style={{ color: 'var(--accent)', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
            >
              Retry with Claude
            </button>
          )}
          {isCloud && (
            <button
              onClick={() => onRetry(message.id, 'local')}
              className="text-xs px-2.5 py-1 rounded-full transition-all cursor-pointer active:scale-[0.95]"
              style={{ color: 'var(--text-secondary)', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
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
        className="text-xs px-2.5 py-1 rounded-full transition-all cursor-pointer active:scale-[0.95]"
        style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
      >
        What was sent
      </button>
      {open && snapshot?.prompt_text && (
        <div
          className="mt-2 w-full p-4 rounded-xl text-xs font-mono overflow-auto max-h-64"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
        >
          <div className="mb-2 font-sans" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            ~{snapshot.token_estimate?.toLocaleString()} tokens sent to Claude
          </div>
          <pre className="whitespace-pre-wrap">{snapshot.prompt_text}</pre>
        </div>
      )}
    </>
  );
}

function formatModelBadge(answeredBy: string, latencyMs?: number, _tokensIn?: number, tokensOut?: number): string {
  const parts = answeredBy.split(':');
  const source = parts[0] === 'local' ? 'Local' : 'Claude';
  const model = parts[1] || '';
  const latency = latencyMs ? ` · ${(latencyMs / 1000).toFixed(1)}s` : '';
  const tokens = tokensOut ? ` · ${tokensOut} tok` : '';
  return `${source} · ${model}${latency}${tokens}`;
}
