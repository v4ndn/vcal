import type { StoredItem } from '../../entities/calendar/model/types';
import type { CalendarJournal } from '../../entities/journal/model/types';
import { parseJournalIcon } from './icsUpdate';

export function getJournals(items: StoredItem[]): CalendarJournal[] {
  return items
    .filter((i) => i.component.type === 'VJOURNAL')
    .map((i) => ({
      uid: i.component.uid ?? '',
      summary: i.component.summary ?? '',
      description: (i.component as any).description ?? '',
      icon: parseJournalIcon(i.rawData) || undefined,
      calendarName: i.calendarName,
      calendarColor: i.calendarColor,
      objectUrl: i.objectUrl,
      etag: i.etag,
      rawData: i.rawData,
    }));
}

export type JournalLeaf = { kind: 'note'; name: string; journal: CalendarJournal };
export type JournalFolder = { kind: 'folder'; name: string; path: string; children: JournalNode[] };
export type JournalNode = JournalLeaf | JournalFolder;
export type JournalTreeRoot = { collectionName: string; color?: string; children: JournalNode[] };

function getOrCreateFolder(children: JournalNode[], name: string, path: string): JournalFolder {
  const existing = children.find((n): n is JournalFolder => n.kind === 'folder' && n.name === name);
  if (existing) return existing;
  const folder: JournalFolder = { kind: 'folder', name, path, children: [] };
  children.push(folder);
  return folder;
}

function sortNodes(nodes: JournalNode[]): void {
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const n of nodes) {
    if (n.kind === 'folder') sortNodes(n.children);
  }
}

export function buildJournalTree(journals: CalendarJournal[]): JournalTreeRoot[] {
  const byCollection = new Map<string, { color?: string; children: JournalNode[] }>();

  for (const j of journals) {
    if (!byCollection.has(j.calendarName)) {
      byCollection.set(j.calendarName, { color: j.calendarColor, children: [] });
    }
    const root = byCollection.get(j.calendarName)!;
    const parts = j.summary.split('/').filter(Boolean);
    if (parts.length === 0) continue;

    let cursor = root.children;
    let pathSoFar = '';
    for (let i = 0; i < parts.length - 1; i++) {
      pathSoFar = pathSoFar ? `${pathSoFar}/${parts[i]}` : parts[i];
      const folder = getOrCreateFolder(cursor, parts[i], pathSoFar);
      cursor = folder.children;
    }
    const leafName = parts[parts.length - 1];
    cursor.push({ kind: 'note', name: leafName, journal: j });
  }

  const result: JournalTreeRoot[] = [];
  for (const [name, { color, children }] of byCollection) {
    sortNodes(children);
    result.push({ collectionName: name, color, children });
  }
  result.sort((a, b) => a.collectionName.localeCompare(b.collectionName));
  return result;
}
