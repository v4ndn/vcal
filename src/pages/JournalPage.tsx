import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, Search, FileText, Folder, FolderOpen, BookOpen, Trash2, Pencil, X, Code2, Eye } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useCalendarStore } from '../entities/calendar/model/store';
import { useUIStore } from '../entities/ui/model/store';
import { useThemeStore } from '../entities/theme/model/store';
import { getJournals, buildJournalTree } from '../shared/lib/getJournals';
import type { JournalNode, JournalFolder, JournalTreeRoot } from '../shared/lib/getJournals';
import type { CalendarJournal } from '../entities/journal/model/types';
import { MarkdownEditor } from '../shared/ui/MarkdownEditor';
import ContextMenu from '../shared/ui/ContextMenu';
import ConfirmModal from '../shared/ui/ConfirmModal';
import JournalNoteModal from '../widgets/JournalNoteModal/JournalNoteModal';

// ── types ─────────────────────────────────────────────────────────────────────

type CtxTarget =
  | { kind: 'note'; journal: CalendarJournal }
  | { kind: 'folder'; node: JournalFolder };

type CtxState = { x: number; y: number } & CtxTarget;

type SelectionTarget =
  | { kind: 'note'; uid: string }
  | { kind: 'folder'; path: string; collectionName: string };

type DragSource =
  | { kind: 'note'; journal: CalendarJournal }
  | { kind: 'folder'; node: JournalFolder; collectionName: string };

interface DragPayload {
  notes: CalendarJournal[];
  folders: Array<{ node: JournalFolder; collectionName: string }>;
}

interface DropTarget {
  collectionName: string;
  folderPath: string | null; // null = collection root
}

interface DndProps {
  selectedNoteUids: Set<string>;
  selectedFolderKeys: Set<string>;
  onShiftClick: (t: SelectionTarget) => void;
  onDragStart: (e: React.DragEvent, src: DragSource) => void;
  onDragEnd: () => void;
  dropTarget: DropTarget | null;
  onDragOver: (e: React.DragEvent, t: DropTarget) => void;
  onDrop: (e: React.DragEvent, t: DropTarget) => void;
  onDragLeave: () => void;
}

interface ExpandProps {
  expandedKeys: Set<string>;
  toggleExpanded: (key: string) => void;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function nodeMatchesSearch(node: JournalNode, q: string): boolean {
  if (q === '') return true;
  if (node.kind === 'note') return node.name.toLowerCase().includes(q) || node.journal.summary.toLowerCase().includes(q);
  return node.children.some((c) => nodeMatchesSearch(c, q));
}

function filterNodes(nodes: JournalNode[], q: string): JournalNode[] {
  if (q === '') return nodes;
  return nodes
    .filter((n) => nodeMatchesSearch(n, q))
    .map((n) => {
      if (n.kind === 'folder') return { ...n, children: filterNodes(n.children, q) };
      return n;
    });
}

function collectLeafUids(node: JournalNode): string[] {
  if (node.kind === 'note') return [node.journal.uid];
  return node.children.flatMap(collectLeafUids);
}

function findFolderByPath(nodes: JournalNode[], path: string): JournalFolder | null {
  for (const n of nodes) {
    if (n.kind === 'folder') {
      if (n.path === path) return n;
      const found = findFolderByPath(n.children, path);
      if (found) return found;
    }
  }
  return null;
}

// ── TreeNode ──────────────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: JournalNode;
  depth: number;
  collectionName: string;
  selectedUid: string | null;
  onSelect: (j: CalendarJournal) => void;
  onCreate: (prefixPath: string) => void;
  onContextMenu: (e: React.MouseEvent, target: CtxTarget) => void;
  forceOpen?: boolean;
  dnd: DndProps;
  expand: ExpandProps;
}

function TreeNode({ node, depth, collectionName, selectedUid, onSelect, onCreate, onContextMenu, forceOpen, dnd, expand }: TreeNodeProps) {
  const folderKey = node.kind === 'folder' ? `${collectionName}:::${node.path}` : '';
  const isOpen = forceOpen ? true : (node.kind === 'folder' && expand.expandedKeys.has(folderKey));
  const indent = depth * 12;

  if (node.kind === 'note') {
    const isSelected = selectedUid === node.journal.uid;
    const isMultiSelected = dnd.selectedNoteUids.has(node.journal.uid);
    const CustomIcon = node.journal.icon ? (LucideIcons as Record<string, any>)[node.journal.icon] : null;

    return (
      <button
        draggable
        onClick={(e) => {
          if (e.shiftKey) { e.preventDefault(); dnd.onShiftClick({ kind: 'note', uid: node.journal.uid }); }
          else onSelect(node.journal);
        }}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, { kind: 'note', journal: node.journal }); }}
        onDragStart={(e) => { e.stopPropagation(); dnd.onDragStart(e, { kind: 'note', journal: node.journal }); }}
        onDragEnd={() => dnd.onDragEnd()}
        className={`w-full flex items-center gap-1.5 py-1 pr-2 rounded-lg text-left transition-all text-xs font-medium
          ${isSelected ? 'bg-th-subtle text-th-text' : ''}
          ${isMultiSelected && !isSelected ? 'bg-th-accent/10 text-th-text ring-1 ring-inset ring-th-accent/40' : ''}
          ${!isSelected && !isMultiSelected ? 'text-th-muted hover:text-th-text hover:bg-th-hover' : ''}`}
        style={{ paddingLeft: indent + 8 }}
      >
        {CustomIcon
          ? <CustomIcon size={12} className="shrink-0 opacity-70" />
          : <FileText size={12} className="shrink-0 opacity-60" />
        }
        <span className="flex-1 truncate">{node.name}</span>
      </button>
    );
  }

  // Folder
  const isFolderSelected = dnd.selectedFolderKeys.has(folderKey);
  const isDropTarget = dnd.dropTarget?.collectionName === collectionName && dnd.dropTarget?.folderPath === node.path;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); dnd.onDragOver(e, { collectionName, folderPath: node.path }); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dnd.onDrop(e, { collectionName, folderPath: node.path }); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { e.stopPropagation(); dnd.onDragLeave(); } }}
    >
      <button
        draggable
        onClick={(e) => {
          if (e.shiftKey) { e.preventDefault(); dnd.onShiftClick({ kind: 'folder', path: node.path, collectionName }); }
          else expand.toggleExpanded(folderKey);
        }}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, { kind: 'folder', node }); }}
        onDragStart={(e) => { e.stopPropagation(); dnd.onDragStart(e, { kind: 'folder', node, collectionName }); }}
        onDragEnd={() => dnd.onDragEnd()}
        className={`group w-full flex items-center gap-1.5 py-1 pr-2 rounded-lg text-left transition-all text-xs font-medium
          ${isFolderSelected ? 'bg-th-accent/10 text-th-text ring-1 ring-inset ring-th-accent/40' : 'text-th-muted hover:text-th-text hover:bg-th-hover'}
          ${isDropTarget ? '!ring-1 !ring-inset !ring-th-accent !bg-th-accent/15' : ''}`}
        style={{ paddingLeft: indent + 8 }}
      >
        {isOpen
          ? <FolderOpen size={12} className="shrink-0 opacity-60" />
          : <Folder size={12} className="shrink-0 opacity-60" />
        }
        <span className="flex-1 truncate">{node.name}</span>
        <span
          role="button"
          onClick={(e) => { e.stopPropagation(); onCreate(node.path); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 flex items-center justify-center rounded hover:bg-th-border text-th-muted"
          title="New note in this folder"
        >
          <Plus size={10} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <TreeNode
                key={child.kind === 'note' ? child.journal.uid : child.path}
                node={child}
                depth={depth + 1}
                collectionName={collectionName}
                selectedUid={selectedUid}
                onSelect={onSelect}
                onCreate={onCreate}
                onContextMenu={onContextMenu}
                forceOpen={forceOpen}
                dnd={dnd}
                expand={expand}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── CollectionSection ─────────────────────────────────────────────────────────

interface CollectionSectionProps {
  root: JournalTreeRoot;
  selectedUid: string | null;
  onSelect: (j: CalendarJournal) => void;
  onCreate: (prefixPath: string, collectionName?: string) => void;
  onContextMenu: (e: React.MouseEvent, target: CtxTarget) => void;
  searchQuery: string;
  dnd: DndProps;
  expand: ExpandProps;
}

function CollectionSection({ root, selectedUid, onSelect, onCreate, onContextMenu, searchQuery, dnd, expand }: CollectionSectionProps) {
  const collectionKey = `__collection__${root.collectionName}`;
  const open = expand.expandedKeys.has(collectionKey);
  const filteredChildren = useMemo(() => filterNodes(root.children, searchQuery), [root.children, searchQuery]);
  const forceOpen = searchQuery !== '';
  const isDropTarget = dnd.dropTarget?.collectionName === root.collectionName && dnd.dropTarget?.folderPath === null;

  return (
    <div
      className="mb-1"
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); dnd.onDragOver(e, { collectionName: root.collectionName, folderPath: null }); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dnd.onDrop(e, { collectionName: root.collectionName, folderPath: null }); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { e.stopPropagation(); dnd.onDragLeave(); } }}
    >
      <button
        onClick={() => expand.toggleExpanded(collectionKey)}
        className={`group w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all hover:bg-th-hover
          ${isDropTarget ? 'ring-1 ring-inset ring-th-accent bg-th-accent/15' : ''}`}
      >
        <BookOpen size={12} className="text-th-muted shrink-0" />
        <span className="flex-1 text-xs font-semibold text-th-text truncate">{root.collectionName}</span>
        <span
          role="button"
          onClick={(e) => { e.stopPropagation(); onCreate('', root.collectionName); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 flex items-center justify-center rounded hover:bg-th-border text-th-muted"
          title="New note in this journal"
        >
          <Plus size={10} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {(forceOpen || open) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="overflow-hidden"
          >
            {filteredChildren.length === 0 && (
              <p className="px-4 py-2 text-[11px] text-th-muted/50">No notes</p>
            )}
            {filteredChildren.map((node) => (
              <TreeNode
                key={node.kind === 'note' ? node.journal.uid : node.path}
                node={node}
                depth={0}
                collectionName={root.collectionName}
                selectedUid={selectedUid}
                onSelect={onSelect}
                onCreate={(path) => onCreate(path, root.collectionName)}
                onContextMenu={onContextMenu}
                forceOpen={forceOpen}
                dnd={dnd}
                expand={expand}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── NoteEditor ────────────────────────────────────────────────────────────────

interface NoteEditorProps {
  journal: CalendarJournal;
}

function NoteEditor({ journal }: NoteEditorProps) {
  const updateJournal = useCalendarStore((s) => s.updateJournal);

  const [body, setBody] = useState(journal.description);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rawMode, setRawMode] = useState(false);
  const bodyRef = useRef(body);
  bodyRef.current = body;

  useEffect(() => {
    setBody(journal.description);
    setDirty(false);
  }, [journal.uid]);

  const handleBodyChange = useCallback((v: string) => {
    setBody(v);
    setDirty(true);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateJournal(journal.uid, { summary: journal.summary, description: bodyRef.current });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/Cmd+S saves the note (works while typing in the editor). Refs avoid stale closures.
  const saveStateRef = useRef({ dirty, saving, save: handleSave });
  saveStateRef.current = { dirty, saving, save: handleSave };
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        const { dirty: d, saving: s, save } = saveStateRef.current;
        if (d && !s) save();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const bodyWrapRef = useRef<HTMLDivElement>(null);

  function focusEditorAtEnd() {
    const el = bodyWrapRef.current?.querySelector<HTMLElement>('[contenteditable]');
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  return (
    <div className="flex flex-col h-full relative">
      <div className="absolute top-3 right-4 z-10 flex items-center gap-1.5">
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-th-accent text-th-accent-fg hover:opacity-90 disabled:opacity-40 transition-opacity shadow-sm"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
        <button
          onClick={() => setRawMode((v) => !v)}
          title={rawMode ? 'Switch to editor' : 'Switch to raw'}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors shadow-sm ${
            rawMode
              ? 'bg-th-accent text-th-accent-fg'
              : 'bg-th-surface border border-th-border text-th-muted hover:text-th-text'
          }`}
        >
          {rawMode ? <Eye size={13} /> : <Code2 size={13} />}
        </button>
      </div>

      {rawMode ? (
        <textarea
          value={body ?? ''}
          onChange={(e) => { setBody(e.target.value); setDirty(true); }}
          placeholder="Start writing…"
          className="flex-1 w-full resize-none px-6 py-4 bg-transparent text-th-text font-mono text-sm outline-none placeholder-th-muted/40 leading-relaxed"
        />
      ) : (
        <div
          ref={bodyWrapRef}
          className="flex-1 overflow-y-auto px-6 py-4 cursor-text"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('[contenteditable]')) return;
            focusEditorAtEnd();
          }}
        >
          <MarkdownEditor
            key={journal.uid}
            defaultValue={body}
            onChange={handleBodyChange}
            placeholder="Start writing…"
            className="min-h-full"
          />
        </div>
      )}
    </div>
  );
}

// ── JournalPage ───────────────────────────────────────────────────────────────

export default function JournalPage() {
  const storedJournals = useCalendarStore((s) => s.journals);
  const allCalendars = useCalendarStore((s) => s.calendars);
  const deleteJournal = useCalendarStore((s) => s.deleteJournal);
  const updateJournal = useCalendarStore((s) => s.updateJournal);
  const calendars = allCalendars.filter((c) => c.isJournal);
  const selectedCollection = useUIStore((s) => s.selectedJournalCollection);

  const sidebarSide = useThemeStore((s) => s.sidebarSide);
  const storedPanelWidth = useThemeStore((s) => s.journalSidebarWidth);
  const setJournalSidebarWidth = useThemeStore((s) => s.setJournalSidebarWidth);
  const [panelWidth, setPanelWidth] = useState(storedPanelWidth);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(0);
  const currentWidthRef = useRef(storedPanelWidth);

  function startResize(e: React.PointerEvent<HTMLDivElement>) {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartW.current = panelWidth;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onResizeMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return;
    const delta = sidebarSide === 'right'
      ? dragStartX.current - e.clientX
      : e.clientX - dragStartX.current;
    const w = Math.max(160, Math.min(480, dragStartW.current + delta));
    currentWidthRef.current = w;
    setPanelWidth(w);
  }

  function stopResize() {
    if (!isDragging.current) return;
    isDragging.current = false;
    setJournalSidebarWidth(currentWidthRef.current);
  }

  const journals = useMemo(() => getJournals(storedJournals), [storedJournals]);
  const filteredJournals = useMemo(
    () => selectedCollection ? journals.filter((j) => j.calendarName === selectedCollection) : journals,
    [journals, selectedCollection],
  );
  const tree = useMemo(() => buildJournalTree(filteredJournals), [filteredJournals]);

  // Expanded folders (persisted)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('vcalendar-journal-expanded');
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleExpanded = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      localStorage.setItem('vcalendar-journal-expanded', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const expand: ExpandProps = { expandedKeys, toggleExpanded };

  // View state
  const [selectedUid, setSelectedUid] = useState<string | null>(() => {
    try { return localStorage.getItem('vcalendar-journal-selected-note') ?? null; } catch { return null; }
  });

  const [openTabUids, setOpenTabUids] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('vcalendar-journal-tabs');
      const tabs: string[] = stored ? JSON.parse(stored) : [];
      const selected = localStorage.getItem('vcalendar-journal-selected-note');
      if (selected && !tabs.includes(selected)) return [...tabs, selected];
      return tabs;
    } catch {
      return [];
    }
  });

  const persistTabs = (tabs: string[]) => {
    try { localStorage.setItem('vcalendar-journal-tabs', JSON.stringify(tabs)); } catch {}
  };

  const openTabs = useMemo(
    () => openTabUids
      .map((uid) => journals.find((j) => j.uid === uid))
      .filter(Boolean)
      .map((j) => ({ uid: j!.uid, name: j!.summary.split('/').pop() ?? j!.summary })),
    [openTabUids, journals],
  );

  const [dragTabUid, setDragTabUid] = useState<string | null>(null);

  const handleTabDragStart = (e: React.DragEvent, uid: string) => {
    setDragTabUid(uid);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', uid);
  };

  const handleTabDragOver = (e: React.DragEvent, uid: string) => {
    e.preventDefault();
    if (!dragTabUid || dragTabUid === uid) return;
    setOpenTabUids((prev) => {
      const from = prev.indexOf(dragTabUid);
      const to = prev.indexOf(uid);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, dragTabUid);
      persistTabs(next);
      return next;
    });
  };

  const handleTabDragEnd = () => setDragTabUid(null);

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalPrefill, setModalPrefill] = useState<{ title: string; calendarName: string }>({ title: '', calendarName: '' });
  const [editingJournal, setEditingJournal] = useState<CalendarJournal | null>(null);
  const [ctx, setCtx] = useState<CtxState | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  // Selection state
  const [selectedNoteUids, setSelectedNoteUids] = useState<Set<string>>(new Set());
  const [selectedFolderKeys, setSelectedFolderKeys] = useState<Set<string>>(new Set());

  // DnD state
  const dragPayloadRef = useRef<DragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const dragLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedJournal = useMemo(
    () => journals.find((j) => j.uid === selectedUid) ?? null,
    [journals, selectedUid],
  );

  useEffect(() => {
    if (selectedUid) localStorage.setItem('vcalendar-journal-selected-note', selectedUid);
    else localStorage.removeItem('vcalendar-journal-selected-note');
  }, [selectedUid]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable) return;
      if (e.key === 'n' || e.key === 'N') { handleCreate('', calendars[0]?.name ?? ''); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [calendars]);

  // ── handlers ───────────────────────────────────────────────────────────────

  const handleSelect = (j: CalendarJournal) => {
    setSelectedNoteUids(new Set());
    setSelectedFolderKeys(new Set());
    setOpenTabUids((prev) => {
      if (prev.includes(j.uid)) return prev;
      const next = [...prev, j.uid];
      persistTabs(next);
      return next;
    });
    setSelectedUid(j.uid);
  };

  const handleCloseTab = (uid: string) => {
    const next = openTabUids.filter((u) => u !== uid);
    persistTabs(next);
    setOpenTabUids(next);
    if (selectedUid === uid) {
      const idx = openTabUids.indexOf(uid);
      setSelectedUid(next.length > 0 ? next[Math.max(0, idx - 1)] : null);
    }
  };

  const handleCreate = (prefixPath: string, collectionName?: string) => {
    const prefix = prefixPath ? `${prefixPath}/` : '';
    const defaultCal = collectionName ?? calendars[0]?.name ?? '';
    setModalPrefill({ title: prefix, calendarName: defaultCal });
    setShowModal(true);
  };

  const handleContextMenu = (e: React.MouseEvent, target: CtxTarget) => {
    setCtx({ x: e.clientX, y: e.clientY, ...target });
  };

  const requestConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirm({ title, message, onConfirm });
  };

  const handleDeleteNote = (journal: CalendarJournal) => {
    requestConfirm(
      'Delete note',
      `"${journal.summary}" will be permanently deleted.`,
      async () => {
        await deleteJournal(journal.uid);
        handleCloseTab(journal.uid);
      },
    );
  };

  const handleDeleteFolder = (node: JournalFolder) => {
    const uids = collectLeafUids(node);
    if (!uids.length) return;
    const count = uids.length;
    requestConfirm(
      `Delete "${node.name}"`,
      `This will permanently delete ${count} note${count > 1 ? 's' : ''} inside this folder.`,
      async () => {
        await Promise.all(uids.map((uid) => deleteJournal(uid)));
        if (selectedUid && uids.includes(selectedUid)) setSelectedUid(null);
      },
    );
  };

  // ── selection ──────────────────────────────────────────────────────────────

  const handleShiftClick = (t: SelectionTarget) => {
    if (t.kind === 'note') {
      setSelectedNoteUids((prev) => {
        const next = new Set(prev);
        if (next.has(t.uid)) next.delete(t.uid); else next.add(t.uid);
        return next;
      });
    } else {
      const key = `${t.collectionName}:::${t.path}`;
      setSelectedFolderKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
    }
  };

  // ── drag and drop ──────────────────────────────────────────────────────────

  const buildSelectedFolders = useCallback((keys: Set<string>): Array<{ node: JournalFolder; collectionName: string }> => {
    return [...keys].flatMap((key) => {
      const sep = key.indexOf(':::');
      const collection = key.slice(0, sep);
      const path = key.slice(sep + 3);
      const treeRoot = tree.find((r) => r.collectionName === collection);
      if (!treeRoot) return [];
      const folder = findFolderByPath(treeRoot.children, path);
      if (!folder) return [];
      return [{ node: folder, collectionName: collection }];
    });
  }, [tree]);

  const handleDragStart = (e: React.DragEvent, src: DragSource) => {
    e.dataTransfer.effectAllowed = 'move';
    // Provide minimal text so the browser shows a drag ghost
    e.dataTransfer.setData('text/plain', src.kind === 'note' ? src.journal.summary : src.node.name);

    const srcInSelection =
      src.kind === 'note'
        ? selectedNoteUids.has(src.journal.uid)
        : selectedFolderKeys.has(`${src.collectionName}:::${src.node.path}`);

    if (srcInSelection && (selectedNoteUids.size + selectedFolderKeys.size) > 1) {
      dragPayloadRef.current = {
        notes: journals.filter((j) => selectedNoteUids.has(j.uid)),
        folders: buildSelectedFolders(selectedFolderKeys),
      };
    } else {
      dragPayloadRef.current =
        src.kind === 'note'
          ? { notes: [src.journal], folders: [] }
          : { notes: [], folders: [{ node: src.node, collectionName: src.collectionName }] };
    }
  };

  const handleDragEnd = () => {
    dragPayloadRef.current = null;
    setDropTarget(null);
  };

  const handleDragOver = (_e: React.DragEvent, target: DropTarget) => {
    if (dragLeaveTimerRef.current) clearTimeout(dragLeaveTimerRef.current);
    setDropTarget(target);
  };

  const handleDragLeave = () => {
    dragLeaveTimerRef.current = setTimeout(() => setDropTarget(null), 30);
  };

  const handleDrop = async (_e: React.DragEvent, target: DropTarget) => {
    if (dragLeaveTimerRef.current) clearTimeout(dragLeaveTimerRef.current);
    setDropTarget(null);

    const payload = dragPayloadRef.current;
    if (!payload) return;
    dragPayloadRef.current = null;

    const ops: Promise<void>[] = [];

    for (const note of payload.notes) {
      const leaf = note.summary.split('/').pop() ?? note.summary;
      const newSummary = target.folderPath ? `${target.folderPath}/${leaf}` : leaf;
      const targetCal = target.collectionName !== note.calendarName ? target.collectionName : undefined;
      if (newSummary !== note.summary || targetCal) {
        ops.push(updateJournal(note.uid, { summary: newSummary, description: note.description, icon: note.icon }, targetCal));
      }
    }

    for (const { node: folderNode, collectionName } of payload.folders) {
      // Skip if dropping onto itself or its own subtree
      if (target.collectionName === collectionName && target.folderPath !== null) {
        if (target.folderPath === folderNode.path) continue;
        if (target.folderPath.startsWith(folderNode.path + '/')) continue;
      }
      const folderName = folderNode.path.split('/').pop() ?? folderNode.path;
      const leafUids = collectLeafUids(folderNode);
      for (const uid of leafUids) {
        const note = journals.find((j) => j.uid === uid);
        if (!note) continue;
        const suffix = note.summary.slice(folderNode.path.length + 1);
        const newSummary = target.folderPath
          ? `${target.folderPath}/${folderName}/${suffix}`
          : `${folderName}/${suffix}`;
        const targetCal = target.collectionName !== note.calendarName ? target.collectionName : undefined;
        if (newSummary !== note.summary || targetCal) {
          ops.push(updateJournal(note.uid, { summary: newSummary, description: note.description, icon: note.icon }, targetCal));
        }
      }
    }

    await Promise.all(ops);
    setSelectedNoteUids(new Set());
    setSelectedFolderKeys(new Set());
  };

  const dnd: DndProps = {
    selectedNoteUids,
    selectedFolderKeys,
    onShiftClick: handleShiftClick,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    dropTarget,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
    onDragLeave: handleDragLeave,
  };

  // ── context menu items ────────────────────────────────────────────────────

  const searchQuery = search.toLowerCase();

  const ctxItems = ctx
    ? ctx.kind === 'note'
      ? [
          { label: 'Edit', icon: <Pencil size={14} />, onClick: () => setEditingJournal(ctx.journal) },
          { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onClick: () => handleDeleteNote(ctx.journal) },
        ]
      : [
          { label: 'Delete folder', icon: <Trash2 size={14} />, danger: true, onClick: () => handleDeleteFolder(ctx.node) },
        ]
    : [];

  return (
    <div className={`flex h-full overflow-hidden bg-th-bg ${sidebarSide === 'right' ? 'flex-row-reverse' : ''}`}>
      {/* Left: tree panel */}
      <div style={{ width: panelWidth }} className={`shrink-0 h-full overflow-x-hidden overflow-y-auto ${sidebarSide === 'right' ? 'border-l' : 'border-r'} border-th-border bg-th-surface relative`}>
        <div className="sticky top-0 z-10 w-full flex items-center gap-1.5 px-2 py-2 border-b border-th-border bg-th-surface">
          <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-th-subtle border border-th-border text-xs">
            <Search size={11} className="text-th-muted shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="flex-1 bg-transparent outline-none text-th-text placeholder-th-muted/50 min-w-0"
            />
          </div>
        </div>

        <div className="py-1 px-1">
          {tree.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 text-th-muted/50 py-16">
              <BookOpen size={28} strokeWidth={1.5} />
              <p className="text-xs text-center px-4 leading-relaxed">No journal entries yet.</p>
              <button
                onClick={() => handleCreate('', calendars[0]?.name ?? '')}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-th-border text-th-muted hover:text-th-text hover:bg-th-hover transition-colors"
                title="New note"
              >
                <Plus size={16} />
              </button>
            </div>
          )}
          {tree.map((root) => (
            <CollectionSection
              key={root.collectionName}
              root={root}
              selectedUid={selectedUid}
              onSelect={handleSelect}
              onCreate={handleCreate}
              onContextMenu={handleContextMenu}
              searchQuery={searchQuery}
              dnd={dnd}
              expand={expand}
            />
          ))}
        </div>
        {/* Resize handle */}
        <div
          onPointerDown={startResize}
          onPointerMove={onResizeMove}
          onPointerUp={stopResize}
          onPointerCancel={stopResize}
          className={`absolute inset-y-0 ${sidebarSide === 'right' ? 'left-0' : 'right-0'} w-1 cursor-col-resize hover:bg-th-accent/40 active:bg-th-accent/60 transition-colors z-10`}
        />
      </div>

      {/* Right: note content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Tab bar */}
        {openTabs.length > 0 && (
          <div className="flex items-stretch border-b border-th-border bg-th-surface shrink-0 overflow-x-auto">
            {openTabs.map((tab) => {
              const isActive = selectedUid === tab.uid;
              const isDragging = dragTabUid === tab.uid;
              return (
                <button
                  key={tab.uid}
                  draggable
                  onDragStart={(e) => handleTabDragStart(e, tab.uid)}
                  onDragOver={(e) => handleTabDragOver(e, tab.uid)}
                  onDrop={(e) => e.preventDefault()}
                  onDragEnd={handleTabDragEnd}
                  onClick={() => setSelectedUid(tab.uid)}
                  className={`group relative flex items-center gap-1.5 px-3 py-2 border-r border-th-border text-xs font-medium shrink-0 transition-colors max-w-[200px] min-w-0 select-none ${
                    isActive
                      ? 'bg-th-bg text-th-text'
                      : isDragging
                      ? 'opacity-40 bg-th-subtle text-th-muted'
                      : 'text-th-muted hover:text-th-text hover:bg-th-hover'
                  }`}
                >
                  <FileText size={11} className="shrink-0 opacity-60" />
                  <span className="truncate flex-1 min-w-0">{tab.name}</span>
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.uid); }}
                    className={`shrink-0 w-4 h-4 flex items-center justify-center rounded transition-colors hover:bg-th-border ${
                      isActive ? 'opacity-40 hover:opacity-100' : 'opacity-0 group-hover:opacity-40 hover:!opacity-100'
                    }`}
                  >
                    <X size={9} />
                  </span>
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-th-accent" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {selectedJournal ? (
          <NoteEditor
            key={selectedJournal.uid}
            journal={selectedJournal}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-th-muted/40">
            <BookOpen size={40} strokeWidth={1} />
            <p className="text-sm">Select a note to view it</p>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      <AnimatePresence>
        {confirm && (
          <ConfirmModal
            title={confirm.title}
            message={confirm.message}
            onConfirm={confirm.onConfirm}
            onClose={() => setConfirm(null)}
          />
        )}
      </AnimatePresence>

      {/* Context menu */}
      <AnimatePresence>
        {ctx && (
          <ContextMenu
            x={ctx.x}
            y={ctx.y}
            items={ctxItems}
            onClose={() => setCtx(null)}
          />
        )}
      </AnimatePresence>

      {/* Create modal */}
      <AnimatePresence>
        {showModal && (
          <JournalNoteModal
            mode="create"
            initialTitle={modalPrefill.title}
            initialCalendar={modalPrefill.calendarName}
            onClose={() => setShowModal(false)}
            onCreated={(uid) => { setShowModal(false); setSelectedUid(uid); }}
          />
        )}
      </AnimatePresence>

      {/* Edit modal */}
      <AnimatePresence>
        {editingJournal && (
          <JournalNoteModal
            mode="edit"
            journal={editingJournal}
            onClose={() => setEditingJournal(null)}
            onSaved={() => setEditingJournal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
