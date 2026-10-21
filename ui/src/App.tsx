import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatThread } from './components/ChatThread';
import { Composer } from './components/Composer';
import { Sidebar } from './components/Sidebar';
import type { Conversation, Message } from './lib/api';
import {
  deleteConversation,
  getMessages,
  listConversations,
  streamChat,
} from './lib/api';

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState('auto');
  const abortRef = useRef<AbortController | null>(null);

  const refreshConversations = useCallback(async () => {
    try {
      const convs = await listConversations();
      setConversations(convs);
    } catch {
      // backend might not be running
    }
  }, []);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    if (activeId) {
      getMessages(activeId).then(setMessages).catch(() => {});
    } else {
      setMessages([]);
    }
  }, [activeId]);

  const handleNewChat = () => {
    setActiveId(null);
    setMessages([]);
    setStreamingText('');
    setError(null);
  };

  const handleDelete = async (id: string) => {
    await deleteConversation(id);
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
    refreshConversations();
  };

  const handleSend = (text: string) => {
    setError(null);
    const userMessage: Message = {
      id: 'temp-' + Date.now(),
      conversation_id: activeId || '',
      role: 'user',
      text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setStreamingText('');
    setIsStreaming(true);

    const controller = streamChat(text, activeId, {
      onToken: (token) => {
        setStreamingText((prev) => prev + token);
      },
      onDone: (data) => {
        setIsStreaming(false);
        setStreamingText('');
        if (!activeId) {
          setActiveId(data.conversation_id);
        }
        getMessages(data.conversation_id).then(setMessages).catch(() => {});
        refreshConversations();
      },
      onError: (err) => {
        setIsStreaming(false);
        setStreamingText('');
        setError(err);
      },
    });
    abortRef.current = controller;
  };

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNewChat}
        onDelete={handleDelete}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <ChatThread
          messages={messages}
          streamingText={streamingText}
          isStreaming={isStreaming}
          error={error}
        />
        <Composer
          onSend={handleSend}
          disabled={isStreaming}
          mode={mode}
          onModeChange={setMode}
        />
      </main>
    </div>
  );
}
