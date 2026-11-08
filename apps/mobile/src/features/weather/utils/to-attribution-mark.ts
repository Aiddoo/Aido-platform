import type { AttributionInfo } from '../domains/weather-report.model';

export type AttributionBackground = 'light' | 'dark';

export type AttributionMark = { kind: 'logo'; uri: string } | { kind: 'text'; serviceName: string };

function toLogoDensity(pixelRatio: number): '1x' | '2x' | '3x' {
  if (pixelRatio > 2) {
    return '3x';
  }
  if (pixelRatio > 1) {
    return '2x';
  }
  return '1x';
}

/** 어두운 바탕(하늘 장면·다크 테마)에는 흰 글자 로고(dark), 밝은 바탕에는 검은 글자 로고(light)를 쓴다 */
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
