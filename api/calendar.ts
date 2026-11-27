import { fetchUsdMacroCalendar } from './_lib/feeds';

interface ApiResponse {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: unknown): void };
}

export default async function handler(_req: unknown, res: ApiResponse) {
  try {
    const events = await fetchUsdMacroCalendar();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ events, fetchedAt: Date.now() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch calendar';
    res.status(502).json({ error: message, events: [] });
  }
}
