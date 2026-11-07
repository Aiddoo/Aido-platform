import type { AttributionInfo } from '../schemas/weather-report.schema';

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

/**
 * 어두운 바탕(하늘 장면·다크 테마)에는 흰 글자 로고(dark), 밝은 바탕에는 검은 글자 로고(light)를 쓴다.
 * 화면 밀도에 맞는 해상도 하나를 골라 1x 크기로 그려야 늘어나 흐려지지 않는다.
 * 로고를 받지 못하면 서비스 이름을 글자로 표기해 출처 표기가 빠지지 않게 한다.
 */
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
