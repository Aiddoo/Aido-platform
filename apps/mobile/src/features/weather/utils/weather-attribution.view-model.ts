import type { AttributionInfo } from '../domains/weather-report.model';

export type AttributionBackground = 'light' | 'dark';

export type AttributionMark = { kind: 'logo'; uri: string } | { kind: 'text'; serviceName: string };

/** 화면 밀도보다 낮은 해상도를 고르면 늘어나 흐려지므로 같거나 한 단계 높은 해상도를 고른다. */
function toLogoDensity(pixelRatio: number): '1x' | '2x' | '3x' {
  if (pixelRatio > 2) {
    return '3x';
  }
  if (pixelRatio > 1) {
    return '2x';
  }
  return '1x';
}

/** 어두운 바탕에는 흰 글자 로고(dark)를 쓰고, 로고가 없으면 서비스 이름으로 표기해 출처가 빠지지 않게 한다 */
export function toAttributionMark(
  attribution: AttributionInfo,
  background: AttributionBackground,
  pixelRatio: number,
): AttributionMark {
  if (attribution.logo == null) {
    return { kind: 'text', serviceName: attribution.serviceName };
  }
  return { kind: 'logo', uri: attribution.logo[background][toLogoDensity(pixelRatio)] };
}
