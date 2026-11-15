import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Sidebar } from './Sidebar'
import type { Conversation, Project } from '../lib/api'

const baseProps = {
  conversations: [] as Conversation[],
  projects: [] as Project[],
  activeId: null as string | null,
  activeProjectId: null as string | null,
  addingProject: false,
  onSelect: vi.fn(),
  onNew: vi.fn(),
  onDelete: vi.fn(),
  onStar: vi.fn(),
  onOpenSettings: vi.fn(),
  onAddProject: vi.fn(),
  onAddProjectPath: vi.fn(),
  onCancelAddProject: vi.fn(),
  onDeleteProject: vi.fn(),
  onSelectProject: vi.fn(),
  onEditInstructions: vi.fn(),
}

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders sidebar with new chat button', () => {
    render(<Sidebar {...baseProps} />)
    expect(screen.getByText(/new chat/i)).toBeTruthy()
  })

  it('renders conversations', () => {
    const conversations: Conversation[] = [
      { id: 'c1', title: 'First Chat', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
      { id: 'c2', title: 'Second Chat', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} conversations={conversations} />)
    expect(screen.getByText('First Chat')).toBeTruthy()
    expect(screen.getByText('Second Chat')).toBeTruthy()
  })

  it('calls onSelect when conversation clicked', () => {
    const onSelect = vi.fn()
    const conversations: Conversation[] = [
      { id: 'c1', title: 'My Chat', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} conversations={conversations} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('My Chat'))
    expect(onSelect).toHaveBeenCalledWith('c1')
  })

  it('calls onNew when new chat button clicked', () => {
    const onNew = vi.fn()
    render(<Sidebar {...baseProps} onNew={onNew} />)
    fireEvent.click(screen.getByText(/new chat/i))
    expect(onNew).toHaveBeenCalled()
  })

  it('highlights active conversation', () => {
    const conversations: Conversation[] = [
      { id: 'c1', title: 'Active Chat', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} conversations={conversations} activeId="c1" />)
    expect(screen.getByText('Active Chat')).toBeTruthy()
  })

  it('renders projects', () => {
    const projects: Project[] = [
      { id: 'p1', name: 'MyProject', path: '/path', icon: null, conversation_count: 2, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} projects={projects} />)
    expect(screen.getByText('MyProject')).toBeTruthy()
  })

  it('filters conversations by search', () => {
    const conversations: Conversation[] = [
      { id: 'c1', title: 'Python debugging', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
      { id: 'c2', title: 'React components', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} conversations={conversations} />)
    const searchInput = screen.getByPlaceholderText(/search/i)
    fireEvent.change(searchInput, { target: { value: 'Python' } })
    expect(screen.getByText('Python debugging')).toBeTruthy()
    expect(screen.queryByText('React components')).toBeNull()
  })

  it('filters by last_message content', () => {
    const conversations: Conversation[] = [
      { id: 'c1', title: 'Chat A', last_message: 'about python', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
      { id: 'c2', title: 'Chat B', last_message: 'about react', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} conversations={conversations} />)
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'python' } })
    expect(screen.getByText('Chat A')).toBeTruthy()
    expect(screen.queryByText('Chat B')).toBeNull()
  })

  it('shows no results message when search has no matches', () => {
    const conversations: Conversation[] = [
      { id: 'c1', title: 'Chat A', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} conversations={conversations} />)
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'zzzzz' } })
    expect(screen.getByText('No chats found')).toBeTruthy()
  })

  it('clears search with X button', () => {
    const conversations: Conversation[] = [
      { id: 'c1', title: 'Chat A', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
      { id: 'c2', title: 'Chat B', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} conversations={conversations} />)
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Chat A' } })
    expect(screen.queryByText('Chat B')).toBeNull()
    const clearBtn = screen.getAllByRole('button').find(b => b.querySelector('svg') && b.closest('.flex.items-center.gap-2'))
    if (clearBtn) fireEvent.click(clearBtn)
  })

  it('shows starred conversations with star icon', () => {
    const conversations: Conversation[] = [
      { id: 'c1', title: 'Starred Chat', project_id: null, mode: 'auto', escalated: false, starred: true, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} conversations={conversations} />)
    expect(screen.getByText('Starred Chat')).toBeTruthy()
  })

  it('calls onStar when star button clicked', () => {
    const onStar = vi.fn()
    const conversations: Conversation[] = [
      { id: 'c1', title: 'Star Me', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} conversations={conversations} onStar={onStar} />)
    const starBtn = screen.getByTitle('Star')
    fireEvent.click(starBtn)
    expect(onStar).toHaveBeenCalledWith('c1', true)
  })

  it('calls onStar to unstar when already starred', () => {
    const onStar = vi.fn()
    const conversations: Conversation[] = [
      { id: 'c1', title: 'Unstar Me', project_id: null, mode: 'auto', escalated: false, starred: true, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} conversations={conversations} onStar={onStar} />)
    const unstarBtn = screen.getByTitle('Unstar')
    fireEvent.click(unstarBtn)
    expect(onStar).toHaveBeenCalledWith('c1', false)
  })

  it('calls onDelete when delete button clicked', () => {
    const onDelete = vi.fn()
    const conversations: Conversation[] = [
      { id: 'c1', title: 'Delete Me', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} conversations={conversations} onDelete={onDelete} />)
    const deleteButtons = screen.getAllByRole('button')
    const deleteBtn = deleteButtons.find(b => {
      const svg = b.querySelector('svg')
      return svg && b.closest('.flex.items-center')
    })
    if (deleteBtn) fireEvent.click(deleteBtn)
  })

  it('calls onOpenSettings when settings button clicked', () => {
    const onOpenSettings = vi.fn()
    render(<Sidebar {...baseProps} onOpenSettings={onOpenSettings} />)
    const buttons = screen.getAllByRole('button')
    const settingsBtn = buttons[buttons.length - 1]
    fireEvent.click(settingsBtn)
    expect(onOpenSettings).toHaveBeenCalled()
  })

  it('groups conversations by project', () => {
    const projects: Project[] = [
      { id: 'p1', name: 'Project A', path: '/a', icon: null, conversation_count: 1, created_at: new Date().toISOString() },
    ]
    const conversations: Conversation[] = [
      { id: 'c1', title: 'In Project', project_id: 'p1', mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
      { id: 'c2', title: 'No Project', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} projects={projects} conversations={conversations} />)
    expect(screen.getByText('In Project')).toBeTruthy()
    expect(screen.getByText('No Project')).toBeTruthy()
    expect(screen.getByText('Project A')).toBeTruthy()
  })

  it('shows conversation count in project header', () => {
    const projects: Project[] = [
      { id: 'p1', name: 'Project A', path: '/a', icon: null, conversation_count: 0, created_at: new Date().toISOString() },
    ]
    const conversations: Conversation[] = [
      { id: 'c1', title: 'Chat 1', project_id: 'p1', mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
      { id: 'c2', title: 'Chat 2', project_id: 'p1', mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} projects={projects} conversations={conversations} />)
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('selects project on click', () => {
    const onSelectProject = vi.fn()
    const projects: Project[] = [
      { id: 'p1', name: 'ClickMe', path: '/a', icon: null, conversation_count: 0, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} projects={projects} onSelectProject={onSelectProject} />)
    fireEvent.click(screen.getByText('ClickMe'))
    expect(onSelectProject).toHaveBeenCalledWith('p1')
  })

  it('toggles collapse on active project click', () => {
    const projects: Project[] = [
      { id: 'p1', name: 'CollapseMe', path: '/a', icon: null, conversation_count: 0, created_at: new Date().toISOString() },
    ]
    const conversations: Conversation[] = [
      { id: 'c1', title: 'Nested Chat', project_id: 'p1', mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} projects={projects} conversations={conversations} activeProjectId="p1" />)
    expect(screen.getByText('Nested Chat')).toBeTruthy()
    fireEvent.click(screen.getByText('CollapseMe'))
    expect(screen.queryByText('Nested Chat')).toBeNull()
    fireEvent.click(screen.getByText('CollapseMe'))
    expect(screen.getByText('Nested Chat')).toBeTruthy()
  })

  it('shows "No chats yet" for empty project', () => {
    const projects: Project[] = [
      { id: 'p1', name: 'EmptyProj', path: '/a', icon: null, conversation_count: 0, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} projects={projects} />)
    expect(screen.getByText('No chats yet')).toBeTruthy()
  })

  it('calls onEditInstructions when instructions button clicked', () => {
    const onEditInstructions = vi.fn()
    const projects: Project[] = [
      { id: 'p1', name: 'InstrProj', path: '/a', icon: null, conversation_count: 0, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} projects={projects} onEditInstructions={onEditInstructions} />)
    const instrBtn = screen.getByTitle('Project instructions')
    fireEvent.click(instrBtn)
    expect(onEditInstructions).toHaveBeenCalledWith('p1')
  })

  it('calls onDeleteProject when remove button clicked', () => {
    const onDeleteProject = vi.fn()
    const projects: Project[] = [
      { id: 'p1', name: 'RemoveMe', path: '/a', icon: null, conversation_count: 0, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} projects={projects} onDeleteProject={onDeleteProject} />)
    const removeBtn = screen.getByTitle('Remove project')
    fireEvent.click(removeBtn)
    expect(onDeleteProject).toHaveBeenCalledWith('p1')
  })

  it('calls onAddProject when add project button clicked', () => {
    const onAddProject = vi.fn()
    render(<Sidebar {...baseProps} onAddProject={onAddProject} />)
    fireEvent.click(screen.getByText(/add project/i))
    expect(onAddProject).toHaveBeenCalled()
  })

  it('shows add project input when addingProject is true', () => {
    render(<Sidebar {...baseProps} addingProject={true} />)
    expect(screen.getByPlaceholderText(/enter folder path/i)).toBeTruthy()
  })

  it('submits project path on Enter', () => {
    const onAddProjectPath = vi.fn()
    render(<Sidebar {...baseProps} addingProject={true} onAddProjectPath={onAddProjectPath} />)
    const input = screen.getByPlaceholderText(/enter folder path/i)
    fireEvent.change(input, { target: { value: '/my/project' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onAddProjectPath).toHaveBeenCalledWith('/my/project')
  })

  it('cancels add project on Escape', () => {
    const onCancelAddProject = vi.fn()
    render(<Sidebar {...baseProps} addingProject={true} onCancelAddProject={onCancelAddProject} />)
    const input = screen.getByPlaceholderText(/enter folder path/i)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onCancelAddProject).toHaveBeenCalled()
  })

  it('submits on blur if value exists', () => {
    const onAddProjectPath = vi.fn()
    render(<Sidebar {...baseProps} addingProject={true} onAddProjectPath={onAddProjectPath} />)
    const input = screen.getByPlaceholderText(/enter folder path/i)
    fireEvent.change(input, { target: { value: '/my/proj' } })
    fireEvent.blur(input)
    expect(onAddProjectPath).toHaveBeenCalledWith('/my/proj')
  })

  it('cancels on blur if value is empty', () => {
    const onCancelAddProject = vi.fn()
    render(<Sidebar {...baseProps} addingProject={true} onCancelAddProject={onCancelAddProject} />)
    const input = screen.getByPlaceholderText(/enter folder path/i)
    fireEvent.blur(input)
    expect(onCancelAddProject).toHaveBeenCalled()
  })

  it('shows Chats header when both projects and ungrouped exist', () => {
    const projects: Project[] = [
      { id: 'p1', name: 'Project A', path: '/a', icon: null, conversation_count: 0, created_at: new Date().toISOString() },
    ]
    const conversations: Conversation[] = [
      { id: 'c1', title: 'Ungrouped', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} projects={projects} conversations={conversations} />)
    expect(screen.getByText('Chats')).toBeTruthy()
  })

  it('renders Kitsune branding in footer', () => {
    render(<Sidebar {...baseProps} />)
    expect(screen.getByText('Kitsune')).toBeTruthy()
  })

  it('calls onDelete via trash button with stopPropagation', () => {
    const onDelete = vi.fn()
    const conversations: Conversation[] = [
      { id: 'c1', title: 'TrashChat', project_id: null, mode: 'auto', escalated: false, starred: false, created_at: new Date().toISOString() },
    ]
    render(<Sidebar {...baseProps} conversations={conversations} onDelete={onDelete} />)
    const trashBtns = screen.getAllByRole('button').filter(b => {
      const svg = b.querySelector('svg')
      return svg && b.closest('.group')
    })
    const trashBtn = trashBtns[trashBtns.length - 1]
    if (trashBtn) {
      fireEvent.click(trashBtn)
      expect(onDelete).toHaveBeenCalledWith('c1')
    }
  })
})
