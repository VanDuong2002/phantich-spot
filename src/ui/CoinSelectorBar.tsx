import { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Search } from 'lucide-react';
import type { SymbolInfo, Ticker24h } from '../types/market';
import { formatPercent, formatPrice } from '../utils/format';

export interface CoinSelectorBarProps {
  selectedSymbol: string;
  symbols: SymbolInfo[];
  watchlist: string[];
  tickers: Record<string, Ticker24h>;
  onSelectSymbol: (symbol: string) => void;
  onToggleWatchlist: (symbol: string) => void;
}

function formatPairLabel(symbol: string): string {
  if (symbol.endsWith('USDT') && symbol.length > 4) {
    return `${symbol.slice(0, -4)}/USDT`;
  }
  return symbol;
}

export function CoinSelectorBar({
  selectedSymbol,
  symbols,
  watchlist,
  tickers,
  onSelectSymbol,
  onToggleWatchlist,
}: CoinSelectorBarProps) {
  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isWatched = watchlist.includes(selectedSymbol);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const suggestions = useMemo(() => {
    const trimmed = query.trim().toUpperCase().replace('/', '');
    const source = symbols.length > 0
      ? symbols
      : watchlist.map((s) => ({
          symbol: s,
          baseAsset: s.replace(/USDT$/, ''),
          quoteAsset: 'USDT',
          status: 'TRADING',
        }));

    if (!trimmed) {
      return source.slice(0, 10);
    }

    const startsWith: SymbolInfo[] = [];
    const contains: SymbolInfo[] = [];

    for (const item of source) {
      if (item.baseAsset.startsWith(trimmed) || item.symbol.startsWith(trimmed)) {
        startsWith.push(item);
      } else if (item.symbol.includes(trimmed)) {
        contains.push(item);
      }
      if (startsWith.length + contains.length >= 24) break;
    }

    return [...startsWith, ...contains].slice(0, 12);
  }, [query, symbols, watchlist]);

  function commitSelection(symbol: string) {
    const normalized = symbol.trim().toUpperCase().replace('/', '');
    if (!normalized) return;
    const finalSymbol = normalized.endsWith('USDT') ? normalized : `${normalized}USDT`;
    onSelectSymbol(finalSymbol);
    setQuery('');
    setDropdownOpen(false);
  }

  return (
    <section
      aria-label="Chọn cặp tiền và danh sách theo dõi"
      className="border-b border-[#D6D0C4] py-3"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Search input + Pin button */}
        <div className="flex items-center gap-2">
          <div ref={containerRef} className="relative flex-1 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#57534E]" />
            <input
              type="text"
              value={query}
              onFocus={() => setDropdownOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setDropdownOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (suggestions.length > 0) {
                    commitSelection(suggestions[0].symbol);
                  } else if (query.trim()) {
                    commitSelection(query);
                  }
                } else if (e.key === 'Escape') {
                  setDropdownOpen(false);
                }
              }}
              placeholder="Tìm cặp /USDT (VD: BTC, SOL...)"
              aria-label="Tìm cặp tiền USDT trên Binance"
              className="w-full border border-[#D6D0C4] bg-[#FAF7F0] py-1.5 pr-3 pl-8 text-xs text-[#1C1917] placeholder:text-[#57534E] focus:border-[#1C1917] focus:outline-none"
            />

            {dropdownOpen && suggestions.length > 0 && (
              <ul
                role="listbox"
                className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto border border-[#1C1917] bg-[#FAF7F0] shadow-md"
              >
                {suggestions.map((item) => {
                  const active = item.symbol === selectedSymbol;
                  return (
                    <li key={item.symbol}>
                      <button
                        type="button"
                        onClick={() => commitSelection(item.symbol)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#1C1917] text-[#FAF7F0]'
                            : 'text-[#1C1917] hover:bg-[#F3EFE6]'
                        }`}
                      >
                        <span className="font-mono-tabular font-semibold">
                          {item.baseAsset}/{item.quoteAsset}
                        </span>
                        <span className={active ? 'text-[#D6D0C4]' : 'text-[#57534E]'}>
                          {item.symbol}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={() => onToggleWatchlist(selectedSymbol)}
            aria-pressed={isWatched}
            title={isWatched ? 'Bỏ ghim khỏi Watchlist' : 'Ghim vào Watchlist'}
            className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              isWatched
                ? 'border-[#1C1917] bg-[#1C1917] text-[#FAF7F0]'
                : 'border-[#D6D0C4] bg-[#F3EFE6] text-[#1C1917] hover:border-[#1C1917]'
            }`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${isWatched ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline">{isWatched ? 'Đã ghim' : 'Ghim'}</span>
          </button>
        </div>

        {/* Watchlist ticker tape */}
        <div className="flex flex-1 items-center gap-2 overflow-x-auto pb-0.5 lg:justify-end">
          {watchlist.map((sym) => {
            const ticker = tickers[sym];
            const isActive = sym === selectedSymbol;
            const pct = ticker?.priceChangePercent;
            const isUp = pct !== undefined && pct >= 0;

            return (
              <button
                key={sym}
                type="button"
                onClick={() => onSelectSymbol(sym)}
                className={`flex shrink-0 items-center gap-2.5 border px-3 py-1.5 text-left transition-colors cursor-pointer ${
                  isActive
                    ? 'border-[#1C1917] bg-[#F3EFE6] shadow-[inset_0_-2px_0_#1C1917]'
                    : 'border-[#D6D0C4] bg-[#FAF7F0] hover:border-[#57534E] hover:bg-[#F3EFE6]'
                }`}
              >
                <span className="font-mono-tabular text-xs font-bold text-[#1C1917]">
                  {formatPairLabel(sym)}
                </span>
                {ticker ? (
                  <span className="flex items-center gap-1.5 font-mono-tabular text-[11px]">
                    <span className="text-[#1C1917]">{formatPrice(ticker.lastPrice)}</span>
                    <span
                      className={`font-semibold ${
                        isUp ? 'text-[#15803D]' : 'text-[#B91C1C]'
                      }`}
                    >
                      {formatPercent(ticker.priceChangePercent, true)}
                    </span>
                  </span>
                ) : (
                  <span className="font-mono-tabular text-[11px] text-[#57534E]">—</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
