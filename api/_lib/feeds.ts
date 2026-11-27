export interface FeedNewsItem {
  id: string;
  title: string;
  description: string;
  link: string;
  source: string;
  publishedAt: number;
}

export interface FeedMacroEvent {
  id: string;
  title: string;
  country: string;
  dateIso: string;
  timestampMs: number;
  impact: 'High' | 'Medium' | 'Low';
  forecast: string;
  previous: string;
  isFomc?: boolean;
}

const REQUEST_HEADERS = {
  'User-Agent': 'PhanTichSpot/1.0 (+https://github.com/VanDuong2002/phantich-spot)',
  Accept: 'application/json, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
};

function decodeXmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = block.match(regex);
  return match ? decodeXmlEntities(match[1]) : '';
}

function parseRssXml(xml: string, sourceName: string): FeedNewsItem[] {
  const items: FeedNewsItem[] = [];
  const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  for (const block of itemMatches) {
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const description = extractTag(block, 'description').slice(0, 320);
    const pubDateStr = extractTag(block, 'pubDate');
    const parsedTime = Date.parse(pubDateStr);

    if (!title || !link) continue;
    items.push({
      id: `${sourceName}:${link}`,
      title,
      description,
      link,
      source: sourceName,
      publishedAt: Number.isFinite(parsedTime) ? parsedTime : Date.now(),
    });
  }

  return items;
}

async function fetchRssSource(url: string, sourceName: string): Promise<FeedNewsItem[]> {
  const res = await fetch(url, { headers: REQUEST_HEADERS });
  if (!res.ok) throw new Error(`RSS HTTP ${res.status} from ${sourceName}`);
  const xml = await res.text();
  return parseRssXml(xml, sourceName);
}

interface CryptoCvArticle {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  source?: string;
  category?: string;
}

async function fetchCryptoCvNews(): Promise<FeedNewsItem[]> {
  const res = await fetch('https://cryptocurrency.cv/api/news?limit=40', {
    headers: REQUEST_HEADERS,
  });
  if (!res.ok) throw new Error(`cryptocurrency.cv HTTP ${res.status}`);
  const json = (await res.json()) as { articles?: CryptoCvArticle[] };
  const articles = Array.isArray(json.articles) ? json.articles : [];

  return articles
    .filter((a) => a.title && a.link)
    .map((a) => {
      const ts = a.pubDate ? Date.parse(a.pubDate) : Date.now();
      return {
        id: `cv:${a.link}`,
        title: String(a.title).trim(),
        description: decodeXmlEntities(String(a.description ?? '')).slice(0, 320),
        link: String(a.link),
        source: a.source ? String(a.source) : 'CryptoNews',
        publishedAt: Number.isFinite(ts) ? ts : Date.now(),
      };
    });
}

export async function fetchAggregatedCryptoNews(): Promise<FeedNewsItem[]> {
  const settled = await Promise.allSettled([
    fetchRssSource('https://cointelegraph.com/rss', 'CoinTelegraph'),
    fetchRssSource('https://decrypt.co/feed', 'Decrypt'),
    fetchCryptoCvNews(),
  ]);

  const combined: FeedNewsItem[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      combined.push(...result.value);
    }
  }

  // Deduplicate by normalized lowercase title
  const seen = new Set<string>();
  const unique: FeedNewsItem[] = [];
  for (const item of combined.sort((a, b) => b.publishedAt - a.publishedAt)) {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 64);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique.slice(0, 80);
}

interface RawForexFactoryEvent {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
}

// Official scheduled FOMC rate decision dates (2026-2027, 14:00 US Eastern = 19:00 UTC winter / 18:00 UTC summer)
const SCHEDULED_FOMC_DECISIONS: { title: string; dateIso: string }[] = [
  { title: 'FOMC Statement & Federal Funds Rate Decision', dateIso: '2026-12-09T19:00:00Z' },
  { title: 'FOMC Statement & Federal Funds Rate Decision', dateIso: '2027-01-27T19:00:00Z' },
  { title: 'FOMC Statement & Federal Funds Rate Decision', dateIso: '2027-03-17T18:00:00Z' },
  { title: 'FOMC Statement & Federal Funds Rate Decision', dateIso: '2027-04-28T18:00:00Z' },
  { title: 'FOMC Statement & Federal Funds Rate Decision', dateIso: '2027-06-09T18:00:00Z' },
  { title: 'FOMC Statement & Federal Funds Rate Decision', dateIso: '2027-07-28T18:00:00Z' },
  { title: 'FOMC Statement & Federal Funds Rate Decision', dateIso: '2027-09-15T18:00:00Z' },
  { title: 'FOMC Statement & Federal Funds Rate Decision', dateIso: '2027-10-27T18:00:00Z' },
  { title: 'FOMC Statement & Federal Funds Rate Decision', dateIso: '2027-12-08T19:00:00Z' },
];

export async function fetchUsdMacroCalendar(): Promise<FeedMacroEvent[]> {
  const events: FeedMacroEvent[] = [];

  try {
    const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      headers: REQUEST_HEADERS,
    });
    if (res.ok) {
      const raw = (await res.json()) as RawForexFactoryEvent[];
      if (Array.isArray(raw)) {
        for (const item of raw) {
          if (item.country !== 'USD' || !item.title || !item.date) continue;
          const impact =
            item.impact === 'High' || item.impact === 'Medium' || item.impact === 'Low'
              ? item.impact
              : 'Low';
          const ts = Date.parse(item.date);
          if (!Number.isFinite(ts)) continue;

          const lowerTitle = item.title.toLowerCase();
          const isFomc =
            lowerTitle.includes('fomc') ||
            lowerTitle.includes('fed') ||
            lowerTitle.includes('powell');

          // Keep High, Medium, or any FED/FOMC-related USD event
          if (impact === 'Low' && !isFomc) continue;

          events.push({
            id: `ff:${item.date}:${item.title}`,
            title: item.title,
            country: 'USD',
            dateIso: item.date,
            timestampMs: ts,
            impact,
            forecast: item.forecast ?? '',
            previous: item.previous ?? '',
            isFomc,
          });
        }
      }
    }
  } catch {
    // Fall through to scheduled FOMC milestones
  }

  // Ensure the next upcoming official FOMC decision is always visible
  const now = Date.now();
  const hasUpcomingFomcRate = events.some(
    (e) =>
      e.timestampMs > now &&
      e.title.toLowerCase().includes('federal funds rate'),
  );

  if (!hasUpcomingFomcRate) {
    const nextFomc = SCHEDULED_FOMC_DECISIONS.find((f) => Date.parse(f.dateIso) > now);
    if (nextFomc) {
      events.push({
        id: `fomc:${nextFomc.dateIso}`,
        title: nextFomc.title,
        country: 'USD',
        dateIso: nextFomc.dateIso,
        timestampMs: Date.parse(nextFomc.dateIso),
        impact: 'High',
        forecast: '',
        previous: '',
        isFomc: true,
      });
    }
  }

  return events.sort((a, b) => a.timestampMs - b.timestampMs);
}
