import { useEffect, useState } from 'react';
import { BookOpen, Save, X } from 'lucide-react';
import { getProjectInstructions, setProjectInstructions } from '../lib/api';

interface InstructionsEditorProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

export function InstructionsEditor({ projectId, projectName, onClose }: InstructionsEditorProps) {
  const [content, setContent] = useState('');
  const [sourceFile, setSourceFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLoading(true);
    getProjectInstructions(projectId)
      .then((info) => {
        setContent(info.content || '');
        setSourceFile(info.file);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setProjectInstructions(projectId, content);
      setSourceFile('.kitsune/instructions.md');
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col w-[560px] max-h-[80vh] rounded-xl overflow-hidden"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-light)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div
          className="flex items-center gap-2 px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-light)' }}
        >
          <BookOpen size={16} style={{ color: 'var(--accent)' }} />
          <div className="flex-1">
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Project Instructions
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {projectName}
              {sourceFile && (
                <span className="ml-1.5 opacity-70">({sourceFile})</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg cursor-pointer transition-all active:scale-[0.9]"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-3">
          <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            Instructions are included in the system prompt for every message in this project. Use them to set context, coding style, or project-specific rules.
          </div>
        </div>

        <div className="flex-1 px-5 pb-3 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
              Loading...
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => { setContent(e.target.value); setDirty(true); }}
              placeholder="# Project Instructions&#10;&#10;- Use TypeScript strict mode&#10;- Follow the existing code style&#10;- Always add unit tests for new functions"
              className="w-full h-[300px] px-3 py-2.5 rounded-lg text-sm resize-none outline-none"
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                fontFamily: 'monospace',
                fontSize: '13px',
                lineHeight: 1.6,
              }}
            />
          )}
        </div>

        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid var(--border-light)' }}
        >
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {content.length > 0 ? `${content.length} / 4000 chars` : ''}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-all active:scale-[0.97]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-default"
              style={{
                background: dirty ? 'var(--accent)' : 'var(--bg-secondary)',
                color: dirty ? 'white' : 'var(--text-muted)',
              }}
            >
              <Save size={13} />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
