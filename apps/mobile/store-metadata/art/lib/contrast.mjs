// WCAG 2.2 대비율. 템플릿이 data-contrast로 표시한 글자의 실제 계산 색과 배경색을 비교한다.
// 일반 글자 4.5:1, 큰 글자(24px 이상 또는 굵은 18.66px 이상에 해당하는 헤드라인) 3:1.
export const MINIMUM = { normal: 4.5, large: 3 };

export function parseColor(value) {
  const text = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/u.exec(text);
  if (hex) {
    const digits =
      hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join('') : hex[1];
    return [0, 2, 4].map((index) => Number.parseInt(digits.slice(index, index + 2), 16)).concat(1);
  }
  const rgb = /^rgba?\(([^)]+)\)$/u.exec(text);
  if (rgb) {
    const parts = rgb[1]
      .split(/[\s,/]+/u)
      .filter(Boolean)
      .map(Number);
    return [parts[0], parts[1], parts[2], parts[3] ?? 1];
  }
  throw new Error(`대비 계산에서 읽을 수 없는 색: ${value} (템플릿은 hex·rgb 색만 써요)`);
}

function luminance([red, green, blue]) {
  const channel = (value) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

export function contrastRatio(foreground, background) {
  const bg = parseColor(background);
  const fg = parseColor(foreground);
  const alpha = fg[3];
  const blended = [0, 1, 2].map((index) => fg[index] * alpha + bg[index] * (1 - alpha));
  const [lighter, darker] = [luminance(blended), luminance(bg)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

// report: [{ name, color, background, level }] → 기준 미달 목록
export function contrastFailures(report) {
  return report
    .map((item) => ({ ...item, ratio: contrastRatio(item.color, item.background) }))
    .filter((item) => item.ratio < MINIMUM[item.level]);
}
