import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { WIDGET_BRAND_COLOR } from '@src/features/device/widget/constants/widget.constants';
import { DEFAULT_CATEGORY_COLOR } from '@src/features/planning/category/constants/todo-category.constants';
import { clamp } from 'es-toolkit';

const APP_ROOT = join(__dirname, '../../..');

function readAppFile(path: string) {
  return readFileSync(join(APP_ROOT, path), 'utf8');
}

function readHexColors(source: string, pattern: RegExp) {
  return Array.from(source.matchAll(pattern), ([, hex = '']) => hex.toUpperCase());
}

function readCssMainColors() {
  const css = readAppFile('global.css');
  return Array.from(
    css.matchAll(/--main:\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/g),
    ([, lightness = '', chroma = '', hueDegrees = '']) =>
      oklchToHex(Number(lightness), Number(chroma), Number(hueDegrees)),
  );
}

// CSS Color 4의 OKLCH → OKLab → 선형 sRGB 행렬이다
function oklchToHex(lightness: number, chroma: number, hueDegrees: number) {
  const hueRadians = (hueDegrees * Math.PI) / 180;
  const a = chroma * Math.cos(hueRadians);
  const b = chroma * Math.sin(hueRadians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linearChannels = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${linearChannels.map(toSrgbHexByte).join('')}`.toUpperCase();
}

function toSrgbHexByte(linearChannel: number) {
  const channel = clamp(linearChannel, 0, 1);
  const encoded = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
  return Math.round(encoded * 255)
    .toString(16)
    .padStart(2, '0');
}

/** 서로 import할 수 없는 자리(CSS 토큰·Expo 설정·격리된 iOS 위젯)에 같은 브랜드 주황을 따로 적는다 */
describe('브랜드 주황', () => {
  it('앱 안 토큰·앱 아이콘과 스플래시·위젯·기본 카테고리 색이 한 값이다', () => {
    // Given
    const [cssLightMain, cssDarkMain, ...extraCssMain] = readCssMainColors();
    const [appConfig] = readHexColors(
      readAppFile('app.config.ts'),
      /const BRAND_COLOR = '(#[\dA-Fa-f]{6})'/g,
    );
    const [iosWidget] = readHexColors(
      readAppFile('src/features/device/widget/components/widgets.ios.tsx'),
      /brand: '(#[\dA-Fa-f]{6})'/g,
    );

    // When
    const brandColors = {
      cssLightMain,
      cssDarkMain,
      extraCssMain,
      appConfig,
      iosWidget,
      androidWidget: WIDGET_BRAND_COLOR,
    };

    // Then
    expect(brandColors).toEqual({
      cssLightMain: DEFAULT_CATEGORY_COLOR,
      cssDarkMain: DEFAULT_CATEGORY_COLOR,
      extraCssMain: [],
      appConfig: DEFAULT_CATEGORY_COLOR,
      iosWidget: DEFAULT_CATEGORY_COLOR,
      androidWidget: DEFAULT_CATEGORY_COLOR,
    });
  });
});
