import type { AnalysisReport, TimeframeAnalysis } from '../types/market';
import { formatPercent, formatPrice } from '../utils/format';

export interface NarrativeContext {
  downgradedForHigherTf?: boolean;
  downgradedForRiskReward?: boolean;
  calculatedRiskReward?: number;
  minRiskReward?: number;
}

type NarrativeInput = Omit<AnalysisReport, 'headline' | 'summary' | 'reasons' | 'warnings'>;

function formatPairLabel(symbol: string): string {
  if (symbol.endsWith('USDT') && symbol.length > 4) {
    return `${symbol.slice(0, -4)}/USDT`;
  }
  return symbol;
}

function trendLabelVi(trend: TimeframeAnalysis['trend']): string {
  if (trend === 'UP') return 'tăng';
  if (trend === 'DOWN') return 'giảm';
  return 'đi ngang';
}

function buildHeadline(report: NarrativeInput, context?: NarrativeContext): string {
  const pair = formatPairLabel(report.symbol);
  const { verdict, tradePlan, referenceLevels, timeframes } = report;

  if (verdict === 'MUA' && tradePlan) {
    return `${pair} xác lập cấu trúc tăng đồng thuận, mở ra vùng giải ngân ${formatPrice(tradePlan.entryLow)} – ${formatPrice(tradePlan.entryHigh)}`;
  }

  if (verdict === 'GIU') {
    return `${pair} duy trì nhịp tích lũy ổn định, ưu tiên nắm giữ và theo dõi hỗ trợ ${formatPrice(referenceLevels.nearestSupport)}`;
  }

  if (verdict === 'BAN') {
    return `${pair} suy yếu trên diện rộng, áp lực phân phối chiếm ưu thế quanh ${formatPrice(report.currentPrice)}`;
  }

  // DUNG_NGOAI variants
  if (
    context?.downgradedForHigherTf ||
    (timeframes['1d'].score < -15 && timeframes['4h'].score > 15)
  ) {
    return `${pair} hồi phục ngắn hạn ngược xu hướng ngày (1D), tạm đứng ngoài để tránh bẫy tăng giá`;
  }

  if (context?.downgradedForRiskReward) {
    return `${pair} giữ đà tích cực nhưng tỷ lệ R:R chưa đạt chuẩn an toàn để giải ngân mới`;
  }

  return `${pair} chưa tạo lợi thế xác suất rõ ràng, đứng ngoài quan sát vùng ${formatPrice(referenceLevels.nearestSupport)} – ${formatPrice(referenceLevels.nearestResistance)}`;
}

function buildSummary(report: NarrativeInput, context?: NarrativeContext): string {
  const pair = formatPairLabel(report.symbol);
  const { currentPrice, priceChangePercent24h, score, modeName, timeframes, verdict, tradePlan, referenceLevels } = report;

  const s1 = `${pair} hiện giao dịch quanh ${formatPrice(currentPrice)} (${formatPercent(priceChangePercent24h, true)} trong 24 giờ), đạt điểm tổng hợp ${score.toFixed(1)}/100 theo chế độ ${modeName}.`;

  const s2 = `Bức tranh đa khung ghi nhận xu hướng ${trendLabelVi(timeframes['1w'].trend)} trên khung tuần (1W), ${trendLabelVi(timeframes['1d'].trend)} trên khung ngày (1D), ${trendLabelVi(timeframes['4h'].trend)} ở 4H và ${trendLabelVi(timeframes['1h'].trend)} ở 1H.`;

  let s3: string;
  if (verdict === 'MUA' && tradePlan) {
    s3 = `Kế hoạch giao dịch Spot đề xuất giải ngân vùng ${formatPrice(tradePlan.entryLow)} – ${formatPrice(tradePlan.entryHigh)}, dừng lỗ tại ${formatPrice(tradePlan.stopLoss)} (${formatPercent(tradePlan.stopLossPct)}) và hướng tới mục tiêu chốt lời ${formatPrice(tradePlan.tp1)} và ${formatPrice(tradePlan.tp2)} (R:R ${tradePlan.riskReward.toFixed(2)}).`;
  } else if (verdict === 'BAN') {
    s3 = `Cấu trúc giá hiện bất lợi cho vị thế nắm giữ Spot; nhà đầu tư nên ưu tiên bảo toàn vốn khi vùng kháng cự gần nhất án ngữ tại ${formatPrice(referenceLevels.nearestResistance)} và mốc hỗ trợ kế tiếp lùi về ${formatPrice(referenceLevels.nearestSupport)}.`;
  } else if (verdict === 'GIU') {
    s3 = `Xu hướng chưa đủ đột phá để mở mua mới nhưng vẫn giữ được nền giá tích cực trên hỗ trợ ${formatPrice(referenceLevels.nearestSupport)}, phù hợp tiếp tục nắm giữ và đặt mốc vô hiệu hóa tại ${formatPrice(referenceLevels.invalidationLevel)}.`;
  } else if (context?.downgradedForHigherTf) {
    s3 = `Dù nhịp tăng ngắn hạn cải thiện điểm số, xu hướng giảm chủ đạo của khung ngày (1D) khiến tín hiệu được hạ cấp xuống Đứng ngoài; chỉ nên xem xét lại khi giá vượt vững kháng cự ${formatPrice(referenceLevels.nearestResistance)}.`;
  } else if (context?.downgradedForRiskReward) {
    s3 = `Điểm xu hướng đạt ngưỡng tích cực nhưng biên lợi nhuận so với rủi ro chưa đáp ứng kỷ luật quản trị vốn, do đó hệ thống khuyến nghị chờ nhịp điều chỉnh về gần hỗ trợ ${formatPrice(referenceLevels.nearestSupport)}.`;
  } else {
    s3 = `Tín hiệu giữa các khung thời gian còn phân hóa, nhà đầu tư nên đứng ngoài quan sát phản ứng giá trong biên độ ${formatPrice(referenceLevels.nearestSupport)} – ${formatPrice(referenceLevels.nearestResistance)} trước khi hành động.`;
  }

  return `${s1} ${s2} ${s3}`;
}

function buildReasons(report: NarrativeInput): string[] {
  const reasons: string[] = [];
  const tf1d = report.timeframes['1d'];
  const tf4h = report.timeframes['4h'];
  const snap1d = tf1d.snapshot;
  const snap4h = tf4h.snapshot;

  if (snap1d.ema21 !== null && snap1d.ema50 !== null) {
    if (snap1d.price > snap1d.ema21 && snap1d.ema21 > snap1d.ema50) {
      reasons.push(
        `Cấu trúc EMA khung ngày (1D) ủng hộ xu hướng tăng khi giá đứng trên EMA21 (${formatPrice(snap1d.ema21)}) và EMA50 (${formatPrice(snap1d.ema50)}).`,
      );
    } else if (snap1d.price < snap1d.ema21 && snap1d.ema21 < snap1d.ema50) {
      reasons.push(
        `Cấu trúc EMA khung ngày (1D) suy yếu với giá nằm dưới cả EMA21 (${formatPrice(snap1d.ema21)}) và EMA50 (${formatPrice(snap1d.ema50)}).`,
      );
    } else {
      reasons.push(
        `Giá khung ngày (1D) đang giằng co quanh cụm EMA21 (${formatPrice(snap1d.ema21)}) và EMA50 (${formatPrice(snap1d.ema50)}), chưa xác lập xu hướng một chiều.`,
      );
    }
  }

  if (snap4h.rsi !== null) {
    const rsiVal = snap4h.rsi.toFixed(1);
    if (snap4h.rsi > 75) {
      reasons.push(`RSI khung 4H ở mức cao (${rsiVal}), phản ánh lực mua mạnh nhưng đã tiến sâu vào vùng quá mua.`);
    } else if (snap4h.rsi >= 35 && snap4h.rsi <= 60) {
      reasons.push(`RSI khung 4H duy trì mức ${rsiVal} trong vùng cân bằng – hồi phục lành mạnh, còn dư địa tăng trưởng.`);
    } else if (snap4h.rsi < 30) {
      reasons.push(`RSI khung 4H rơi xuống vùng quá bán (${rsiVal}), cho thấy áp lực bán ngắn hạn vẫn rất lớn.`);
    } else {
      reasons.push(`RSI khung 4H đạt ${rsiVal}, thể hiện động lượng ngắn hạn ở mức ${snap4h.rsi > 60 ? 'tích cực' : 'thận trọng'}.`);
    }
  }

  if (snap4h.macd !== null && snap4h.macdSignal !== null && snap4h.macdHistogram !== null) {
    const aboveSignal = snap4h.macd > snap4h.macdSignal;
    reasons.push(
      aboveSignal
        ? `MACD khung 4H duy trì phía trên đường tín hiệu với histogram dương, xác nhận xung lực tăng ngắn hạn.`
        : `MACD khung 4H nằm dưới đường tín hiệu với histogram âm, cho thấy động lượng nghiêng về phe bán.`,
    );
  }

  if (snap4h.volumeRatio !== null) {
    const ratio = snap4h.volumeRatio.toFixed(2);
    if (snap4h.volumeRatio >= 1.25) {
      reasons.push(`Thanh khoản khung 4H cải thiện rõ rệt (${ratio}x trung bình 20 phiên), củng cố độ tin cậy của nhịp giá hiện tại.`);
    } else if (snap4h.volumeRatio < 0.85) {
      reasons.push(`Khối lượng giao dịch khung 4H thấp hơn bình quân (${ratio}x), dòng tiền lớn chưa nhập cuộc quyết liệt.`);
    } else {
      reasons.push(`Khối lượng khung 4H duy trì ở mức trung bình (${ratio}x), vận động giá diễn ra tương đối ổn định.`);
    }
  }

  if (reasons.length === 0) {
    reasons.push(`Điểm tổng hợp đa khung đạt ${report.score.toFixed(1)}/100 theo trọng số chế độ ${report.modeName}.`);
  }

  return reasons;
}

function buildWarnings(report: NarrativeInput, context?: NarrativeContext): string[] {
  const warnings: string[] = [];
  const tf1w = report.timeframes['1w'];
  const tf1d = report.timeframes['1d'];
  const tf4h = report.timeframes['4h'];

  if (tf1w.snapshot.ema200 === null) {
    warnings.push(
      'Lịch sử khung tuần (1W) chưa đủ 200 nến để tính EMA200; hệ thống đã tự động chuyển sang đánh giá dài hạn theo EMA21/EMA50.',
    );
  }

  if (context?.downgradedForHigherTf) {
    warnings.push(
      `Khung ngày (1D) đang giảm mạnh (${tf1d.score.toFixed(1)} điểm), tín hiệu bị hạ cấp từ Mua xuống Đứng ngoài để tránh giao dịch ngược xu hướng chính.`,
    );
  } else if (tf1d.score < -15 && tf4h.score > 15) {
    warnings.push(
      `Xu hướng khung ngày (1D) đang tiêu cực (${tf1d.score.toFixed(1)} điểm) trái chiều với nhịp hồi khung 4H, tiềm ẩn rủi ro bẫy tăng giá.`,
    );
  }

  if (context?.downgradedForRiskReward) {
    const rrText =
      context.calculatedRiskReward !== undefined ? context.calculatedRiskReward.toFixed(2) : 'thấp';
    const minRrText =
      context.minRiskReward !== undefined ? context.minRiskReward.toFixed(2) : 'quy định';
    warnings.push(
      `Tỷ lệ R:R ước tính (${rrText}) thấp hơn ngưỡng tối thiểu (${minRrText}) của chế độ ${report.modeName}, tín hiệu được hạ cấp xuống Đứng ngoài.`,
    );
  }

  if (tf4h.snapshot.rsi !== null && tf4h.snapshot.rsi > 75) {
    warnings.push(
      `RSI khung 4H đang ở vùng quá mua (${tf4h.snapshot.rsi.toFixed(1)}), cần tránh mua đuổi giá cao và tuân thủ vùng giải ngân đã hoạch định.`,
    );
  }

  if (tf4h.snapshot.volumeRatio !== null && tf4h.snapshot.volumeRatio < 0.7) {
    warnings.push(
      `Khối lượng khung 4H suy yếu (${tf4h.snapshot.volumeRatio.toFixed(2)}x trung bình), biên độ biến động có thể kém bền vững.`,
    );
  }

  return warnings;
}

/**
 * Deterministically generate Vietnamese financial editorial narrative from quantitative analysis results.
 */
export function generateNarrative(
  report: NarrativeInput,
  context?: NarrativeContext,
): {
  headline: string;
  summary: string;
  reasons: string[];
  warnings: string[];
} {
  return {
    headline: buildHeadline(report, context),
    summary: buildSummary(report, context),
    reasons: buildReasons(report),
    warnings: buildWarnings(report, context),
  };
}
