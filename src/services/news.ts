import { annotateMacroEvent } from '../engine/newsAnalyzer';
import type { FearGreedIndex, MacroEvent, NewsBundle, RawNewsItem } from '../types/news';

function classifyFearGreedVi(value: number): string {
  if (value <= 24) return 'Cực kỳ sợ hãi';
  if (value <= 44) return 'Sợ hãi';
  if (value <= 55) return 'Trung tính';
  if (value <= 75) return 'Tham lam';
  return 'Cực kỳ tham lam';
}

async function fetchNewsFromApi(): Promise<RawNewsItem[]> {
  try {
    const res = await fetch('/api/news');
    if (res.ok) {
      const json = (await res.json()) as { items?: RawNewsItem[] };
      if (Array.isArray(json.items) && json.items.length > 0) {
        return json.items;
      }
    }
  } catch {
    // Fallback below
  }

  // Fallback to CORS-open public crypto news endpoint if /api/news is unavailable
  const fallbackRes = await fetch('https://cryptocurrency.cv/api/news?limit=35');
  if (!fallbackRes.ok) {
    throw new Error(`News HTTP ${fallbackRes.status}`);
  }
  const json = (await fallbackRes.json()) as {
    articles?: { title?: string; link?: string; description?: string; pubDate?: string; source?: string }[];
  };
  const articles = Array.isArray(json.articles) ? json.articles : [];
  return articles
    .filter((a) => a.title && a.link)
    .map((a) => {
      const ts = a.pubDate ? Date.parse(a.pubDate) : Date.now();
      return {
        id: `cv:${a.link}`,
        title: String(a.title).trim(),
        description: String(a.description ?? '').replace(/<[^>]+>/g, ' ').slice(0, 320).trim(),
        link: String(a.link),
        source: a.source ? String(a.source) : 'CryptoNews',
        publishedAt: Number.isFinite(ts) ? ts : Date.now(),
      };
    });
}

async function fetchCalendarFromApi(): Promise<MacroEvent[]> {
  try {
    const res = await fetch('/api/calendar');
    if (!res.ok) return [];
    const json = (await res.json()) as { events?: MacroEvent[] };
    const events = Array.isArray(json.events) ? json.events : [];
    return events.map(annotateMacroEvent);
  } catch {
    return [];
  }
}

async function fetchFearGreed(): Promise<FearGreedIndex | null> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { value?: string; value_classification?: string; timestamp?: string }[];
    };
    const latest = json.data?.[0];
    if (!latest?.value) return null;
    const value = Number(latest.value);
    if (!Number.isFinite(value)) return null;
    return {
      value,
      classification: latest.value_classification ?? 'Neutral',
      classificationVi: classifyFearGreedVi(value),
      updatedAt: latest.timestamp ? Number(latest.timestamp) * 1000 : Date.now(),
    };
  } catch {
    return null;
  }
}

/** Fetches aggregated crypto news, USD macro/FED calendar, and Fear & Greed index in parallel. */
export async function fetchNewsBundle(): Promise<NewsBundle> {
  const [rawNews, calendar, fearGreed] = await Promise.all([
    fetchNewsFromApi(),
    fetchCalendarFromApi(),
    fetchFearGreed(),
  ]);

  return {
    rawNews,
    calendar,
    fearGreed,
    fetchedAt: Date.now(),
  };
}
