import type {
  AnalyzedNewsItem,
  MacroEvent,
  NewsCategory,
  NewsFilter,
  NewsImpact,
  NewsMarketSummary,
  NewsSentiment,
  RawNewsItem,
} from '../types/news';

const COIN_PATTERNS: { symbol: string; regex: RegExp }[] = [
  { symbol: 'BTC', regex: /\b(bitcoin|btc)\b/i },
  { symbol: 'ETH', regex: /\b(ethereum|ether|eth)\b/i },
  { symbol: 'SOL', regex: /\b(solana|sol)\b/i },
  { symbol: 'BNB', regex: /\b(binance coin|bnb)\b/i },
  { symbol: 'XRP', regex: /\b(ripple|xrp)\b/i },
  { symbol: 'ADA', regex: /\b(cardano|ada)\b/i },
  { symbol: 'DOGE', regex: /\b(dogecoin|doge)\b/i },
  { symbol: 'LINK', regex: /\b(chainlink|link)\b/i },
  { symbol: 'AVAX', regex: /\b(avalanche|avax)\b/i },
  { symbol: 'SUI', regex: /\b(sui)\b/i },
  { symbol: 'PEPE', regex: /\b(pepe)\b/i },
  { symbol: 'TON', regex: /\b(toncoin|ton)\b/i },
  { symbol: 'TRX', regex: /\b(tron|trx)\b/i },
  { symbol: 'DOT', regex: /\b(polkadot|dot)\b/i },
  { symbol: 'NEAR', regex: /\b(near protocol|near)\b/i },
  { symbol: 'UNI', regex: /\b(uniswap|uni)\b/i },
  { symbol: 'ARB', regex: /\b(arbitrum|arb)\b/i },
  { symbol: 'OP', regex: /\b(optimism)\b/i },
  { symbol: 'HYPE', regex: /\b(hyperliquid|hype)\b/i },
  { symbol: 'LTC', regex: /\b(litecoin|ltc)\b/i },
  { symbol: 'SHIB', regex: /\b(shiba inu|shib)\b/i },
  { symbol: 'AAVE', regex: /\b(aave)\b/i },
  { symbol: 'APT', regex: /\b(aptos|apt)\b/i },
];

const CRYPTO_OR_MACRO_RELEVANCE =
  /\b(crypto|cryptocurrency|bitcoin|btc|ethereum|eth|solana|sol|bnb|xrp|ripple|cardano|dogecoin|chainlink|defi|stablecoin|usdt|usdc|tether|binance|coinbase|kraken|bybit|okx|etf|sec|cftc|fed|fomc|powell|cpi|ppi|pce|nfp|non-farm|interest rate|rate cut|rate hike|inflation|treasury|whale|blockchain|altcoin|token|web3|on-chain|halving|staking|airdrop|mainnet|layer 2|liquidat)/i;

const CATEGORY_RULES: {
  category: NewsCategory;
  labelVi: string;
  impact: NewsImpact;
  regex: RegExp;
}[] = [
  {
    category: 'FED_MACRO',
    labelVi: 'FED & Vĩ mô',
    impact: 'HIGH',
    regex: /\b(fed|federal reserve|fomc|powell|interest rate|rate cut|rate hike|cpi|ppi|pce|inflation|payroll|nfp|recession|treasury yield|dollar index|dxy|tariff)\b/i,
  },
  {
    category: 'ETF_INSTITUTIONAL',
    labelVi: 'ETF & Tổ chức',
    impact: 'HIGH',
    regex: /\b(etf|blackrock|fidelity|grayscale|microstrategy|strategy|institutional|inflow|outflow|spot etf|treasury reserve|sovereign|wall street|pension)\b/i,
  },
  {
    category: 'SECURITY',
    labelVi: 'Bảo mật & Rủi ro',
    impact: 'HIGH',
    regex: /\b(hack|hacked|exploit|breach|stolen|drain|drained|rug pull|scam|extortion|bankrupt|bankruptcy|insolvent|collapse|freeze|suspended withdrawals)\b/i,
  },
  {
    category: 'REGULATION',
    labelVi: 'Pháp lý & SEC',
    impact: 'HIGH',
    regex: /\b(sec|cftc|lawsuit|sue|sued|settlement|approve|approval|ban|banned|crackdown|regulation|regulatory|bill|senate|congress|court|doj|fine|penalty|license)\b/i,
  },
  {
    category: 'EXCHANGE_LISTING',
    labelVi: 'Sàn lớn & Niêm yết',
    impact: 'MEDIUM',
    regex: /\b(binance|coinbase|upbit|kraken|okx|bybit|listing|lists|listed|delist|delisting|launchpad)\b/i,
  },
  {
    category: 'ECOSYSTEM',
    labelVi: 'Nâng cấp & Hệ sinh thái',
    impact: 'MEDIUM',
    regex: /\b(upgrade|mainnet|fork|partnership|launch|launches|integration|burn|token burn|buyback|adoption|protocol)\b/i,
  },
  {
    category: 'MARKET_MOVE',
    labelVi: 'Dòng tiền & Biến động',
    impact: 'MEDIUM',
    regex: /\b(surge|rally|soar|breakout|all-time high|ath|plunge|crash|dump|sell-off|liquidat|whale|accumulate|accumulation|bull|bear)\b/i,
  },
];

const BULLISH_TERMS: { regex: RegExp; weight: number; noteVi: string }[] = [
  { regex: /\b(rate cut|dovish|easing|cooling inflation|lower inflation)\b/i, weight: 38, noteVi: 'Kỳ vọng nới lỏng lãi suất / lạm phát hạ nhiệt' },
  { regex: /\b(inflow|net inflow|record inflow|institutional buying|accumulat|strategic reserve|bitcoin reserve|btc reserve|crypto reserve)\b/i, weight: 32, noteVi: 'Dòng tiền tổ chức / ETF mua ròng' },
  { regex: /\b(approv|greenlight|cleared|wins lawsuit|dismissed|dropped lawsuit|pro-crypto)\b/i, weight: 34, noteVi: 'Tín hiệu pháp lý tích cực' },
  { regex: /\b(surge|rally|soar|jump|breakout|all-time high|ath|rebound|recover|bullish)\b/i, weight: 22, noteVi: 'Động lượng giá & tâm lý tích cực' },
  { regex: /\b(partnership|adoption|mainnet|upgrade|launch|listing|lists|buyback|burn)\b/i, weight: 18, noteVi: 'Cú hích hệ sinh thái / niêm yết' },
];

const BEARISH_TERMS: { regex: RegExp; weight: number; noteVi: string }[] = [
  { regex: /\b(rate hike|hawkish|hot inflation|sticky inflation|higher for longer|tariff)\b/i, weight: 38, noteVi: 'Áp lực vĩ mô / lãi suất diều hâu' },
  { regex: /\b(hack|hacked|exploit|stolen|drained|breach|bankrupt|insolvent|collapse)\b/i, weight: 40, noteVi: 'Rủi ro bảo mật / mất thanh khoản' },
  { regex: /\b(outflow|net outflow|sell-off|dump|liquidat|whale sells|unlock)\b/i, weight: 30, noteVi: 'Áp lực bán / rút vốn ròng' },
  { regex: /\b(lawsuit|sue|sued|crackdown|ban|banned|reject|rejected|delay|delayed|delist|fine|indict)\b/i, weight: 30, noteVi: 'Rủi ro pháp lý / bị từ chối hoặc hủy niêm yết' },
  { regex: /\b(plunge|crash|tumble|slump|drop|fall|bearish|fear|warning)\b/i, weight: 20, noteVi: 'Tâm lý thận trọng / áp lực giảm ngắn hạn' },
];

export function extractRelatedCoins(text: string): string[] {
  const found: string[] = [];
  for (const { symbol, regex } of COIN_PATTERNS) {
    if (regex.test(text)) found.push(symbol);
  }
  return found;
}

export function isMarketRelevantNews(item: RawNewsItem): boolean {
  const text = `${item.title} ${item.description}`;
  return CRYPTO_OR_MACRO_RELEVANCE.test(text);
}

export function analyzeSingleNewsItem(item: RawNewsItem): AnalyzedNewsItem | null {
  if (!isMarketRelevantNews(item)) return null;

  const text = `${item.title} ${item.description}`;
  const coins = extractRelatedCoins(text);

  let matchedCategory = CATEGORY_RULES.find((r) => r.regex.test(text));
  if (!matchedCategory) {
    // Only keep general crypto articles if they mention a known coin or clear market signal
    if (coins.length === 0) return null;
    matchedCategory = {
      category: 'MARKET_MOVE',
      labelVi: 'Thị trường Coin',
      impact: 'MEDIUM',
      regex: /.*/,
    };
  }

  let bullScore = 0;
  let bearScore = 0;
  let topBullNote = '';
  let topBearNote = '';

  for (const term of BULLISH_TERMS) {
    if (term.regex.test(text)) {
      bullScore += term.weight;
      if (!topBullNote) topBullNote = term.noteVi;
    }
  }
  for (const term of BEARISH_TERMS) {
    if (term.regex.test(text)) {
      bearScore += term.weight;
      if (!topBearNote) topBearNote = term.noteVi;
    }
  }

  const rawScore = Math.max(-100, Math.min(100, bullScore - bearScore));
  let sentiment: NewsSentiment = 'NEUTRAL';
  if (rawScore >= 15) sentiment = 'BULLISH';
  else if (rawScore <= -15) sentiment = 'BEARISH';

  const reasonVi =
    sentiment === 'BULLISH'
      ? topBullNote || 'Tin tức nghiêng về hướng hỗ trợ tâm lý mua'
      : sentiment === 'BEARISH'
        ? topBearNote || 'Tin tức tạo áp lực thận trọng / bán ngắn hạn'
        : 'Tin trung tính, cần theo dõi thêm phản ứng giá';

  return {
    ...item,
    sentiment,
    sentimentScore: rawScore,
    impact: matchedCategory.impact,
    category: matchedCategory.category,
    categoryLabelVi: matchedCategory.labelVi,
    coins,
    reasonVi,
  };
}

export function summarizeNewsSentiment(
  items: AnalyzedNewsItem[],
  scopeLabel?: string,
): NewsMarketSummary {
  const bullishCount = items.filter((i) => i.sentiment === 'BULLISH').length;
  const bearishCount = items.filter((i) => i.sentiment === 'BEARISH').length;
  const neutralCount = items.filter((i) => i.sentiment === 'NEUTRAL').length;
  const highImpactCount = items.filter((i) => i.impact === 'HIGH').length;

  let weightedSum = 0;
  let weightTotal = 0;
  const themeCounts = new Map<string, number>();

  for (const item of items) {
    const w = item.impact === 'HIGH' ? 2 : 1;
    weightedSum += item.sentimentScore * w;
    weightTotal += w;
    themeCounts.set(item.categoryLabelVi, (themeCounts.get(item.categoryLabelVi) ?? 0) + 1);
  }

  const avgScore = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 0;
  const outlook: NewsMarketSummary['outlook'] =
    avgScore >= 10 ? 'TANG' : avgScore <= -10 ? 'GIAM' : 'TRUNG_TINH';

  const topThemesVi = [...themeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label);

  const subject = scopeLabel ? `Tin tức ${scopeLabel}` : 'Dòng tin thị trường Crypto';

  const headlineVi =
    items.length === 0
      ? `${subject}: Chưa ghi nhận tin tức tác động nổi bật`
      : outlook === 'TANG'
        ? `${subject} nghiêng về kịch bản TĂNG (+${avgScore} điểm)`
        : outlook === 'GIAM'
          ? `${subject} tạo áp lực GIẢM (${avgScore} điểm)`
          : `${subject} đang ở thế TRUNG TÍNH, giằng co hai chiều`;

  const themesText = topThemesVi.length > 0 ? topThemesVi.join(', ') : 'biến động thị trường';
  const summaryVi =
    items.length === 0
      ? 'Chưa có bản tin tác động lớn phù hợp bộ lọc hiện tại. Bạn có thể chuyển sang chế độ xem toàn thị trường hoặc theo dõi lịch tin đỏ FED bên cạnh.'
      : `Tổng hợp ${items.length} tin có tác động (gồm ${highImpactCount} tin ảnh hưởng mạnh): ${bullishCount} tin tích cực, ${bearishCount} tin tiêu cực và ${neutralCount} tin trung tính. Tâm điểm hiện xoay quanh ${themesText}. ${
          outlook === 'TANG'
            ? 'Xác suất ngắn hạn nghiêng về chiều hỗ trợ lực mua nếu biểu đồ kỹ thuật đồng thuận.'
            : outlook === 'GIAM'
              ? 'Cần thận trọng rủi ro rung lắc / chốt lời ngắn hạn, ưu tiên quản trị cắt lỗ chặt.'
              : 'Dòng tin chưa tạo lệch pha rõ rệt; nên ưu tiên quyết định theo cấu trúc kỹ thuật đa khung.'
        }`;

  return {
    outlook,
    score: avgScore,
    bullishCount,
    bearishCount,
    neutralCount,
    highImpactCount,
    headlineVi,
    summaryVi,
    topThemesVi,
  };
}

export function analyzeNewsFeed(rawItems: RawNewsItem[]): {
  items: AnalyzedNewsItem[];
  summary: NewsMarketSummary;
} {
  const analyzed: AnalyzedNewsItem[] = [];
  for (const raw of rawItems) {
    const item = analyzeSingleNewsItem(raw);
    if (item) analyzed.push(item);
  }
  analyzed.sort((a, b) => b.publishedAt - a.publishedAt);
  return {
    items: analyzed,
    summary: summarizeNewsSentiment(analyzed),
  };
}

export function filterNewsItems(
  items: AnalyzedNewsItem[],
  filter: NewsFilter,
  selectedBaseAsset: string,
  searchQuery = '',
): AnalyzedNewsItem[] {
  const base = selectedBaseAsset.trim().toUpperCase();
  const q = searchQuery.trim().toLowerCase();

  return items.filter((item) => {
    if (filter === 'SELECTED_COIN') {
      if (!base) return true;
      const matchCoin =
        item.coins.includes(base) ||
        item.title.toUpperCase().includes(base) ||
        item.description.toUpperCase().includes(base);
      if (!matchCoin) return false;
    } else if (filter === 'FED_MACRO') {
      if (item.category !== 'FED_MACRO') return false;
    } else if (filter === 'BULLISH') {
      if (item.sentiment !== 'BULLISH') return false;
    } else if (filter === 'BEARISH') {
      if (item.sentiment !== 'BEARISH') return false;
    }

    if (q) {
      const hay = `${item.title} ${item.description} ${item.coins.join(' ')} ${item.source}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function annotateMacroEvent(event: MacroEvent): MacroEvent {
  const lower = event.title.toLowerCase();
  let cryptoNoteVi = 'Dữ liệu kinh tế Mỹ — có thể gây biến động ngắn hạn quanh giờ công bố.';

  if (lower.includes('fomc') || lower.includes('federal funds rate') || lower.includes('powell')) {
    cryptoNoteVi =
      'Tin cực mạnh từ FED: giọng điệu bồ câu / hạ lãi suất thường đẩy BTC tăng; diều hâu gây áp lực giảm mạnh.';
  } else if (lower.includes('cpi') || lower.includes('pce') || lower.includes('ppi')) {
    cryptoNoteVi =
      'Thước đo lạm phát Mỹ: số liệu thấp hơn dự báo thường tích cực cho Crypto; cao hơn dự báo dễ gây xả mạnh.';
  } else if (
    lower.includes('non-farm') ||
    lower.includes('unemployment') ||
    lower.includes('payroll') ||
    lower.includes('jobless')
  ) {
    cryptoNoteVi =
      'Dữ liệu việc làm Mỹ: thị trường lao động hạ nhiệt nhẹ giúp củng cố kỳ vọng FED cắt giảm lãi suất.';
  } else if (lower.includes('gdp') || lower.includes('retail sales') || lower.includes('pmi')) {
    cryptoNoteVi =
      'Phản ánh sức khỏe kinh tế Mỹ & khẩu vị rủi ro, tác động gián tiếp lên dòng tiền vào tài sản rủi ro.';
  }

  return { ...event, cryptoNoteVi };
}
