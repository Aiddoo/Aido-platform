import { createAttributionDto, createWeatherReport } from '../__tests__/weather-report.fixtures';
import { toAttributionMark } from './to-attribution-mark';

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
      // Given 로고가 있는 리포트 When 바탕과 화면 밀도로 고르면 Then 그 밀도 이상의 해상도 하나를 고른다
      const { attribution } = createWeatherReport();

      const mark = toAttributionMark(attribution, background, pixelRatio);

      expect(mark.kind === 'logo' && mark.uri.includes(marker)).toBe(true);
    },
  );

  it('로고를 받지 못하면 서비스 이름을 글자로 표기한다', () => {
    // Given 로고가 없는 리포트 When 표기를 고르면 Then 서비스 이름 글자를 쓴다
    const { attribution } = createWeatherReport({
      attribution: createAttributionDto({ logo: null }),
    });

    const mark = toAttributionMark(attribution, 'dark', 3);

    expect(mark).toEqual({ kind: 'text', serviceName: 'Apple Weather' });
  });
});
