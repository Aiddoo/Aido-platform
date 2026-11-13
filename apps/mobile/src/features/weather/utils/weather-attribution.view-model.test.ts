import { createAttributionDto, createWeatherReport } from '../__tests__/weather-report.fixtures';
import { toAttributionMark } from './weather-attribution.view-model';

describe('toAttributionMark', () => {
  it.each([
    ['dark', 1, '_wht_ko_1X_'],
    ['dark', 2, '_wht_ko_2X_'],
    ['dark', 3, '_wht_ko_3X_'],
    ['light', 2.625, '_blk_ko_3X_'],
    ['light', 4, '_blk_ko_3X_'],
  ] as const)(
    '%s 바탕·화면 밀도 %s에는 %s 로고 하나를 고른다',
    (background, pixelRatio, marker) => {
      // Given
      const { attribution } = createWeatherReport();

      // When
      const mark = toAttributionMark(attribution, background, pixelRatio);

      // Then
      expect(mark.kind === 'logo' && mark.uri.includes(marker)).toBe(true);
    },
  );

  it('로고를 받지 못하면 서비스 이름을 글자로 표기한다', () => {
    // Given
    const { attribution } = createWeatherReport({
      attribution: createAttributionDto({ logo: null }),
    });

    // When
    const mark = toAttributionMark(attribution, 'dark', 3);

    // Then
    expect(mark).toEqual({ kind: 'text', serviceName: 'Apple Weather' });
  });
});
