import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadNewsArchive,
  mergeNewsIntoArchive,
  togglePinInArchive,
} from './newsArchive';
import type { RawNewsItem } from '../types/news';

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

function makeRaw(id: string, title: string, publishedAt: number): RawNewsItem {
  return {
    id,
    title,
    description: 'desc',
    link: `https://example.com/${id}`,
    source: 'CoinTelegraph',
    publishedAt,
  };
}

describe('newsArchive', () => {
  beforeEach(() => localStorage.clear());

  it('merges incoming news while preserving older archived items and deduplicating titles', () => {
    const older = makeRaw('old1', 'Bitcoin ETF logs $500M inflow', now - 2 * DAY);
    const s1 = mergeNewsIntoArchive(loadNewsArchive(), [older], now);
    expect(s1.items).toHaveLength(1);

    const newer = makeRaw('new1', 'FED holds rates steady', now - 1000);
    const dup = makeRaw('dup1', 'Bitcoin ETF logs $500M inflow', now - 2 * DAY);
    const s2 = mergeNewsIntoArchive(s1, [newer, dup], now);

    expect(s2.items).toHaveLength(2);
    expect(s2.items[0].id).toBe('new1');
    expect(s2.items[1].id).toBe('old1');
  });

  it('retains pinned items even when older than 7 days', () => {
    const veryOld = makeRaw('pin1', 'Historic FOMC rate cut', now - 12 * DAY);
    const s1 = mergeNewsIntoArchive(
      { items: [veryOld], pinnedIds: ['pin1'], lastSeenAt: 0 },
      [],
      now,
    );
    expect(s1.items.map((i) => i.id)).toContain('pin1');

    const unpinned = togglePinInArchive(s1, 'pin1');
    expect(unpinned.pinnedIds).toEqual([]);
  });
});
