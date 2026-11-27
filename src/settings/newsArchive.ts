import type { RawNewsItem } from '../types/news';

const ARCHIVE_STORAGE_KEY = 'phantich_news_archive_v1';
const MAX_ARCHIVE_ITEMS = 300;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // Keep 7 days of historical news

export interface NewsArchiveState {
  items: RawNewsItem[];
  pinnedIds: string[];
  lastSeenAt: number;
}

function normalizeTitleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 64);
}

export function loadNewsArchive(): NewsArchiveState {
  try {
    const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
    if (!raw) return { items: [], pinnedIds: [], lastSeenAt: 0 };
    const parsed = JSON.parse(raw) as Partial<NewsArchiveState>;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      pinnedIds: Array.isArray(parsed.pinnedIds) ? parsed.pinnedIds : [],
      lastSeenAt: typeof parsed.lastSeenAt === 'number' ? parsed.lastSeenAt : 0,
    };
  } catch {
    return { items: [], pinnedIds: [], lastSeenAt: 0 };
  }
}

export function saveNewsArchive(state: NewsArchiveState): void {
  try {
    localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

/**
 * Merges incoming news items into the persistent archive without deleting older items.
 * Retains items up to 7 days old (max 300) and ALWAYS retains pinned items.
 */
export function mergeNewsIntoArchive(
  existing: NewsArchiveState,
  incoming: RawNewsItem[],
  now = Date.now(),
): NewsArchiveState {
  const pinnedSet = new Set(existing.pinnedIds);
  const byKey = new Map<string, RawNewsItem>();

  for (const item of existing.items) {
    const key = normalizeTitleKey(item.title);
    if (key) byKey.set(key, item);
  }

  for (const item of incoming) {
    const key = normalizeTitleKey(item.title);
    if (!key) continue;
    const prev = byKey.get(key);
    // Keep existing item if already archived (preserves pinned IDs), otherwise insert new
    if (!prev) {
      byKey.set(key, item);
    }
  }

  const cutoff = now - MAX_AGE_MS;
  const merged = [...byKey.values()]
    .filter((item) => pinnedSet.has(item.id) || item.publishedAt >= cutoff)
    .sort((a, b) => b.publishedAt - a.publishedAt);

  // Keep all pinned items plus newest non-pinned up to MAX_ARCHIVE_ITEMS
  const pinnedItems = merged.filter((item) => pinnedSet.has(item.id));
  const regularItems = merged
    .filter((item) => !pinnedSet.has(item.id))
    .slice(0, Math.max(0, MAX_ARCHIVE_ITEMS - pinnedItems.length));

  const finalItems = [...pinnedItems, ...regularItems].sort(
    (a, b) => b.publishedAt - a.publishedAt,
  );

  const next: NewsArchiveState = {
    items: finalItems,
    pinnedIds: existing.pinnedIds,
    lastSeenAt: existing.lastSeenAt,
  };
  saveNewsArchive(next);
  return next;
}

export function togglePinInArchive(
  existing: NewsArchiveState,
  newsId: string,
): NewsArchiveState {
  const exists = existing.pinnedIds.includes(newsId);
  const pinnedIds = exists
    ? existing.pinnedIds.filter((id) => id !== newsId)
    : [newsId, ...existing.pinnedIds];
  const next: NewsArchiveState = { ...existing, pinnedIds };
  saveNewsArchive(next);
  return next;
}
