import type {
  AnalyzedNewsItem,
  DailyNewsDigest,
  MacroEvent,
  NewsCategory,
  NewsFilter,
  NewsImpact,
  NewsMarketSummary,
  NewsSentiment,
  NewsTimeRange,
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

// Exclude user-submitted chart ideas & non-crypto tech/gaming noise
const EXCLUDED_SOURCES = /(tradingview.*ideas)/i;
const EXCLUDED_NOISE_TOPICS =
  /\b(gta 6|video game|1password|spacex.*fcc|movie|netflix|xbox|playstation|nintendo)\b/i;

const CRYPTO_OR_MACRO_RELEVANCE =
  /\b(crypto|cryptocurrency|bitcoin|btc|ethereum|eth|solana|sol|bnb|xrp|ripple|cardano|dogecoin|chainlink|defi|stablecoin|usdt|usdc|tether|binance|coinbase|kraken|bybit|okx|etf|sec|cftc|fed|federal reserve|fomc|powell|cpi|ppi|pce|nfp|non-farm|interest rate|rate cut|rate hike|inflation|treasury yield|whale|blockchain|altcoin|token|web3|on-chain|halving|staking|airdrop|mainnet|layer 2|liquidat)\b/i;

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
  if (EXCLUDED_SOURCES.test(item.source)) return false;
  const text = `${item.title} ${item.description}`;
  if (EXCLUDED_NOISE_TOPICS.test(text) && !/\b(bitcoin|btc|ethereum|eth|crypto|etf|fomc)\b/i.test(text)) {
    return false;
  }
  return CRYPTO_OR_MACRO_RELEVANCE.test(text);
}

function extractHighlightFigure(text: string): string | null {
  const match = text.match(/(\$[0-9]+(?:[.,][0-9]+)?\s?(?:billion|million|B|M|K)?|[0-9]+(?:[.,][0-9]+)?\s?(?:%|bps))/i);
  return match ? match[0].trim() : null;
}

function buildDeepAnalysis(
  category: NewsCategory,
  sentiment: NewsSentiment,
  coins: string[],
  text: string,
): { meaningVi: string; impactVi: string; horizonVi: string; actionHintVi: string } {
  const coinText = coins.length > 0 ? coins.slice(0, 3).join(', ') : 'toàn thị trường Crypto';
  const figure = extractHighlightFigure(text);
  const figureClause = figure ? ` (quy mô đáng chú ý: ${figure})` : '';

  switch (category) {
    case 'FED_MACRO':
      if (sentiment === 'BULLISH') {
        return {
          meaningVi: `Tín hiệu vĩ mô Mỹ / FED nghiêng về nới lỏng chính sách tiền tệ hoặc lạm phát hạ nhiệt${figureClause}.`,
          impactVi: `Lãi suất kỳ vọng giảm giúp chi phí vốn rẻ hơn và đồng USD suy yếu, thường kích thích dòng tiền lớn chảy vào ${coinText}.`,
          horizonVi: 'Trung hạn (1D–1W)',
          actionHintVi: 'Tích cực cho xu hướng chính; ưu tiên canh nhịp chỉnh về hỗ trợ 4H/1D để giải ngân Spot.',
        };
      }
      if (sentiment === 'BEARISH') {
        return {
          meaningVi: `Tín hiệu vĩ mô / FED mang sắc thái diều hâu, cảnh báo lạm phát dai dẳng hoặc duy trì lãi suất cao${figureClause}.`,
          impactVi: `Lợi suất trái phiếu Mỹ và DXY có xu hướng tăng, hút thanh khoản khỏi tài sản rủi ro và tạo áp lực bán lên ${coinText}.`,
          horizonVi: 'Ngắn & Trung hạn',
          actionHintVi: 'Thận trọng rủi ro rung lắc mạnh; không mua đuổi, chờ giá ổn định trên hỗ trợ lớn.',
        };
      }
      return {
        meaningVi: `Cập nhật phát biểu hoặc dữ liệu kinh tế Mỹ từ FED / cơ quan thống kê${figureClause}, chưa làm thay đổi đột ngột kỳ vọng lãi suất.`,
        impactVi: `Thị trường ${coinText} thường đi ngang hoặc quét hai đầu quanh thời điểm tin ra trước khi chọn hướng.`,
        horizonVi: 'Ngắn hạn (1H–4H)',
        actionHintVi: 'Quan sát phản ứng nến đóng cửa khung 4H thay vì vào lệnh ngay lúc tin vừa ra.',
      };

    case 'ETF_INSTITUTIONAL':
      if (sentiment === 'BULLISH') {
        return {
          meaningVi: `Các quỹ tổ chức / quỹ Spot ETF ghi nhận dòng tiền mua ròng hoặc mở rộng tích lũy ${coinText}${figureClause}.`,
          impactVi: `Lực mua từ tổ chức trực tiếp hút nguồn cung lưu thông trên sàn, tạo nền giá vững cho BTC và thường lan tỏa sang Altcoin sau 1–2 nhịp.`,
          horizonVi: 'Trung hạn (1D–1W)',
          actionHintVi: 'Củng cố độ tin cậy cho tín hiệu MUA kỹ thuật; có thể giữ lệnh Spot dài hơn tới TP2.',
        };
      }
      if (sentiment === 'BEARISH') {
        return {
          meaningVi: `Dòng tiền tổ chức / ETF có dấu hiệu rút ròng hoặc hạ tỷ trọng nắm giữ ${coinText}${figureClause}.`,
          impactVi: `Lực cầu tổ chức suy yếu làm tăng lượng cung bán trên thị trường giao ngay, dễ kéo giá kiểm định lại các vùng hỗ trợ dưới.`,
          horizonVi: 'Ngắn & Trung hạn',
          actionHintVi: 'Hạn chế bắt đáy sớm; theo dõi xem dòng tiền ETF các phiên kế tiếp có ngừng rút không.',
        };
      }
      return {
        meaningVi: `Cập nhật hoạt động cơ cấu danh mục hoặc hồ sơ ETF liên quan đến ${coinText}${figureClause}.`,
        impactVi: `Tác động tức thời ở mức vừa phải, chủ yếu ảnh hưởng đến kỳ vọng dòng tiền trung hạn.`,
        horizonVi: 'Trung hạn (1D–1W)',
        actionHintVi: 'Theo dõi thêm xác nhận từ khối lượng giao dịch thực tế trên khung 1D.',
      };

    case 'SECURITY':
      return {
        meaningVi: `Cảnh báo sự cố bảo mật, tấn công khai thác lỗ hổng, tống tiền hoặc rủi ro thanh khoản liên quan đến ${coinText}${figureClause}.`,
        impactVi: `Tin bảo mật luôn kích hoạt tâm lý phòng thủ và bán tháo đột ngột do lo ngại hacker xả token ra thị trường.`,
        horizonVi: 'Ngắn hạn (1H–4H)',
        actionHintVi: 'Tuyệt đối không bắt dao rơi với coin bị ảnh hưởng; ưu tiên đứng ngoài hoặc đặt cắt lỗ chặt.',
      };

    case 'REGULATION':
      if (sentiment === 'BULLISH') {
        return {
          meaningVi: `Bước tiến pháp lý thuận lợi (phê duyệt, thắng kiện hoặc khung luật cởi mở hơn) cho ${coinText}${figureClause}.`,
          impactVi: `Giảm rào cản pháp lý giúp nhà đầu tư tổ chức và cá nhân mạnh dạn giải ngân hơn, hỗ trợ mặt bằng giá tăng bền.`,
          horizonVi: 'Trung hạn (1D–1W)',
          actionHintVi: 'Tin nền tảng tốt; kết hợp cấu trúc EMA 4H/1D để tìm điểm vào đẹp sau nhịp hưng phấn đầu tiên.',
        };
      }
      return {
        meaningVi: `Động thái siết chặt pháp lý, điều tra, kiện tụng hoặc trì hoãn phê duyệt từ cơ quan quản lý nhắm vào ${coinText}${figureClause}.`,
        impactVi: `Rủi ro pháp lý làm gia tăng bất định, thường khiến dòng tiền ngắn hạn rút ra đứng ngoài quan sát.`,
        horizonVi: 'Ngắn & Trung hạn',
        actionHintVi: 'Hạ tỷ trọng hoặc chờ thị trường hấp thụ xong tin xấu và giữ vững đáy hỗ trợ 1D.',
      };

    case 'EXCHANGE_LISTING':
      if (sentiment === 'BEARISH') {
        return {
          meaningVi: `Thông báo hủy niêm yết hoặc siết giao dịch trên sàn lớn liên quan đến ${coinText}${figureClause}.`,
          impactVi: `Thanh khoản giảm mạnh khi mất sàn lớn, dễ dẫn tới áp lực bán tháo kéo dài.`,
          horizonVi: 'Ngắn hạn (1H–4H)',
          actionHintVi: 'Tránh nắm giữ Spot dài hạn đối với coin có nguy cơ bị hủy niêm yết.',
        };
      }
      return {
        meaningVi: `Sàn giao dịch lớn công bố niêm yết mới hoặc cập nhật sản phẩm giao dịch cho ${coinText}${figureClause}.`,
        impactVi: `Mở rộng nguồn thanh khoản và dòng tiền mới, thường tạo sóng tăng nhanh trong ngắn hạn nhưng cũng dễ bị chốt lời ngay sau đó.`,
        horizonVi: 'Ngắn hạn (1H–4H)',
        actionHintVi: 'Không FOMO khi nến 1H đã dựng cột; chờ nhịp kiểm định lại vùng hỗ trợ mới.',
      };

    case 'ECOSYSTEM':
      return {
        meaningVi: `Dự án ${coinText} công bố nâng cấp mạng lưới, hợp tác mới hoặc cơ chế đốt/mua lại token${figureClause}.`,
        impactVi: `Cải thiện giá trị sử dụng thực tế và câu chuyện tăng trưởng (narrative), giúp ${coinText} thu hút dòng tiền tốt hơn mặt bằng chung.`,
        horizonVi: 'Trung hạn (1D–1W)',
        actionHintVi: 'Tốt để đưa vào Watchlist theo dõi; chỉ giải ngân khi khung 4H/1D đồng thuận tăng.',
      };

    default:
      if (sentiment === 'BULLISH') {
        return {
          meaningVi: `Ghi nhận biến động giá tích cực, tín hiệu phá vỡ hoặc cá voi gom mua ${coinText}${figureClause}.`,
          impactVi: `Động lượng ngắn hạn đang nghiêng về phe mua, có thể kéo thêm dòng tiền FOMO tham gia.`,
          horizonVi: 'Ngắn hạn (1H–4H)',
          actionHintVi: 'Đối chiếu ngay với RSI và tỷ lệ R:R ở tab Phân tích chi tiết để tránh mua ở đỉnh ngắn hạn.',
        };
      }
      if (sentiment === 'BEARISH') {
        return {
          meaningVi: `Ghi nhận áp lực bán, thanh lý vị thế hoặc dòng tiền chốt lời trên ${coinText}${figureClause}.`,
          impactVi: `Phe bán đang chiếm ưu thế ngắn hạn, dễ kéo giá quét xuống vùng thanh khoản bên dưới.`,
          horizonVi: 'Ngắn hạn (1H–4H)',
          actionHintVi: 'Đứng ngoài quan sát vùng hỗ trợ gần nhất, chưa vội giải ngân khi 4H chưa có tín hiệu đảo chiều.',
        };
      }
      return {
        meaningVi: `Cập nhật diễn biến thị trường liên quan đến ${coinText}${figureClause}, hai phe mua bán còn giằng co.`,
        impactVi: `Chưa đủ lực tạo xu hướng mới độc lập, giá sẽ đi theo xu hướng chung của BTC và kỹ thuật đa khung.`,
        horizonVi: 'Ngắn hạn (1H–4H)',
        actionHintVi: 'Ưu tiên bám theo tín hiệu chỉ báo EMA/RSI/MACD ở tab Phân tích chi tiết.',
      };
  }
}

export function analyzeSingleNewsItem(item: RawNewsItem): AnalyzedNewsItem | null {
  if (!isMarketRelevantNews(item)) return null;

  const text = `${item.title} ${item.description}`;
  const coins = extractRelatedCoins(text);

  let matchedCategory = CATEGORY_RULES.find((r) => r.regex.test(text));
  if (!matchedCategory) {
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

  const deep = buildDeepAnalysis(matchedCategory.category, sentiment, coins, text);

  return {
    ...item,
    sentiment,
    sentimentScore: rawScore,
    impact: matchedCategory.impact,
    category: matchedCategory.category,
    categoryLabelVi: matchedCategory.labelVi,
    coins,
    reasonVi,
    ...deep,
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
  timeRange: NewsTimeRange = 'ALL',
  pinnedIds: string[] = [],
  now = Date.now(),
): AnalyzedNewsItem[] {
  const base = selectedBaseAsset.trim().toUpperCase();
  const q = searchQuery.trim().toLowerCase();
  const pinnedSet = new Set(pinnedIds);

  return items.filter((item) => {
    if (timeRange === 'PINNED') {
      if (!pinnedSet.has(item.id)) return false;
    } else if (timeRange === '24H') {
      if (now - item.publishedAt > 24 * 60 * 60 * 1000) return false;
    } else if (timeRange === '3D') {
      if (now - item.publishedAt > 3 * 24 * 60 * 60 * 1000) return false;
    }

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
      const hay = `${item.title} ${item.description} ${item.meaningVi} ${item.coins.join(' ')} ${item.source}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function buildDailyNewsDigest(items: AnalyzedNewsItem[]): DailyNewsDigest[] {
  const byDay = new Map<string, DailyNewsDigest>();
  const pad = (n: number) => String(n).padStart(2, '0');

  for (const item of items) {
    const d = new Date(item.publishedAt);
    const key = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
    const bucket = byDay.get(key) ?? {
      dateKey: key,
      total: 0,
      bullish: 0,
      bearish: 0,
      neutral: 0,
    };
    bucket.total += 1;
    if (item.sentiment === 'BULLISH') bucket.bullish += 1;
    else if (item.sentiment === 'BEARISH') bucket.bearish += 1;
    else bucket.neutral += 1;
    byDay.set(key, bucket);
  }

  return [...byDay.values()].slice(0, 5);
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
