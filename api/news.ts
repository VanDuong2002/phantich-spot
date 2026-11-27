import { fetchAggregatedCryptoNews } from './_lib/feeds';

interface ApiResponse {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: unknown): void };
}

export default async function handler(_req: unknown, res: ApiResponse) {
  try {
    const items = await fetchAggregatedCryptoNews();
    res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=300');
    res.status(200).json({ items, fetchedAt: Date.now() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch news';
    res.status(502).json({ error: message, items: [] });
  }
}
