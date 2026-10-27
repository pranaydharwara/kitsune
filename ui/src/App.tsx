import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatThread } from './components/ChatThread';
import { Composer } from './components/Composer';
import { Settings } from './components/Settings';
import { Sidebar } from './components/Sidebar';
import type { Conversation, Message, ModelsResponse, Project, RouteInfo } from './lib/api';
import {
  cancelStream,
  createProject,
  deleteConversation,
  deleteProject,
  getMessages,
  listConversations,
  listModels,
  listProjects,
  streamChat,
  updateConversation,
} from './lib/api';

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState('auto');
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [models, setModels] = useState<ModelsResponse>({ local: [], cloud: [] });
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [speed, setSpeed] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refreshConversations = useCallback(async () => {
    try {
      const convs = await listConversations();
      setConversations(convs);
    } catch {
      // backend might not be running
    }
  }, []);

  const refreshProjects = useCallback(async () => {
    try {
      const projs = await listProjects();
      setProjects(projs);
    } catch {
      // backend might not be running
    }
  }, []);

  useEffect(() => {
    refreshConversations();
    refreshProjects();
    listModels().then(setModels).catch(() => {});
  }, [refreshConversations, refreshProjects]);

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
    setRouteInfo(null);
  };

  const handleDelete = async (id: string) => {
    await deleteConversation(id);
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
    refreshConversations();
    refreshProjects();
  };

  const [addingProject, setAddingProject] = useState(false);

  const handleAddProject = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false, title: 'Select project folder' });
      if (selected) {
        await createProject(selected as string);
        refreshProjects();
      }
    } catch {
      setAddingProject(true);
    }
  };

  const handleAddProjectPath = async (path: string) => {
    setAddingProject(false);
    if (path.trim()) {
      await createProject(path.trim());
      refreshProjects();
    }
  };

  const handleDeleteProject = async (id: string) => {
    await deleteProject(id);
    if (activeProjectId === id) {
      setActiveProjectId(null);
    }
    refreshProjects();
    refreshConversations();
  };

  const handleSelectProject = (id: string | null) => {
    setActiveProjectId(id);
  };

  const handleSend = (text: string) => {
    setError(null);
    setRouteInfo(null);
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
    setSpeed(null);

    const controller = streamChat(text, activeId, {
      onToken: (token) => {
        setStreamingText((prev) => prev + token);
      },
      onRoute: (route) => {
        setRouteInfo(route);
      },
      onDone: async (data) => {
        setIsStreaming(false);
        setStreamingText('');
        if (!activeId) {
          setActiveId(data.conversation_id);
          if (activeProjectId) {
            await updateConversation(data.conversation_id, { project_id: activeProjectId });
          }
        }
        if (data.route) setRouteInfo(data.route);
        if (data.speed) setSpeed(data.speed);
        getMessages(data.conversation_id).then(setMessages).catch(() => {});
        refreshConversations();
        refreshProjects();
      },
      onError: (err) => {
        setIsStreaming(false);
        setStreamingText('');
        setError(err);
      },
      onCancelled: () => {
        setIsStreaming(false);
        setStreamingText('');
        if (activeId) {
          getMessages(activeId).then(setMessages).catch(() => {});
        }
      },
    }, { mode, model: selectedModel || undefined, projectId: activeProjectId || undefined });
    abortRef.current = controller;
  };

  const handleCancel = () => {
    if (activeId) {
      cancelStream(activeId);
    }
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamingText('');
    if (activeId) {
      getMessages(activeId).then(setMessages).catch(() => {});
    }
    refreshConversations();
  };

  const handleRetry = (messageId: string, retryWith: 'local' | 'cloud') => {
    setError(null);
    setRouteInfo(null);
    setStreamingText('');
    setIsStreaming(true);
    setSpeed(null);

    // Remove the last assistant message (the one being retried)
    setMessages((prev) => prev.filter((m) => m.id !== messageId));

    const lastUserMsg = messages.findLast((m) => m.role === 'user');
    if (!lastUserMsg) return;

    const controller = streamChat(lastUserMsg.text, activeId, {
      onToken: (token) => {
        setStreamingText((prev) => prev + token);
      },
      onRoute: (route) => {
        setRouteInfo(route);
      },
      onDone: (data) => {
        setIsStreaming(false);
        setStreamingText('');
        if (data.route) setRouteInfo(data.route);
        if (data.speed) setSpeed(data.speed);
        getMessages(data.conversation_id).then(setMessages).catch(() => {});
        refreshConversations();
      },
      onError: (err) => {
        setIsStreaming(false);
        setStreamingText('');
        setError(err);
      },
      onCancelled: () => {
        setIsStreaming(false);
        setStreamingText('');
        if (activeId) {
          getMessages(activeId).then(setMessages).catch(() => {});
        }
      },
    }, { mode, model: selectedModel || undefined, retryMessageId: messageId, retryWith });
    abortRef.current = controller;
  };

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div
        data-tauri-drag-region="true"
        className="fixed top-0 left-0 right-0 h-11 z-[9999]"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />
      <Sidebar
        conversations={conversations}
        projects={projects}
        activeId={activeId}
        activeProjectId={activeProjectId}
        addingProject={addingProject}
        onSelect={setActiveId}
        onNew={handleNewChat}
        onDelete={handleDelete}
        onOpenSettings={() => setSettingsOpen(true)}
        onAddProject={handleAddProject}
        onAddProjectPath={handleAddProjectPath}
        onCancelAddProject={() => setAddingProject(false)}
        onDeleteProject={handleDeleteProject}
        onSelectProject={handleSelectProject}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <ChatThread
          messages={messages}
          streamingText={streamingText}
          isStreaming={isStreaming}
          error={error}
          routeInfo={routeInfo}
          speed={speed}
          onRetry={handleRetry}
        />
        {activeProjectId && !activeId && (
          <div className="px-6">
            <div
              className="max-w-[720px] mx-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs mb-1"
              style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}
            >
              <span style={{ color: 'var(--accent)' }}>●</span>
              <span>New chat in <strong style={{ color: 'var(--text-primary)' }}>{projects.find(p => p.id === activeProjectId)?.name}</strong></span>
              <button
                onClick={() => setActiveProjectId(null)}
                className="ml-auto text-[10px] px-1.5 py-0.5 rounded cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>
          </div>
        )}
        <Composer
          onSend={handleSend}
          disabled={isStreaming}
          isStreaming={isStreaming}
          onCancel={handleCancel}
          mode={mode}
          selectedModel={selectedModel}
          onSelect={(m, model) => { setMode(m); setSelectedModel(model); }}
          models={models}
        />
      </main>
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} onRefresh={refreshConversations} />
    </div>
  );
}
