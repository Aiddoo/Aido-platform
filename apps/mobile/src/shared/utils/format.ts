const ZERO_DECIMAL_CURRENCIES = new Set(['KRW', 'JPY']);

/** 통화 코드 → 해당 통화의 자연스러운 로케일 매핑 (스토어 지역 기반) */
const CURRENCY_LOCALE_MAP: Record<string, string> = {
  KRW: 'ko-KR',
  JPY: 'ja-JP',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  CNY: 'zh-CN',
  TWD: 'zh-TW',
  CAD: 'en-CA',
  AUD: 'en-AU',
};

function getLocaleForCurrency(currencyCode: string): string {
  return CURRENCY_LOCALE_MAP[currencyCode] ?? 'en-US';
}

/**
 * 개수 뱃지가 넘지 않는 상한. 이보다 크면 자릿수가 계속 늘어 옆 요소를 밀어낸다.
 */
export const COUNT_BADGE_MAX = 99;

/**
 * 좋아요·답글처럼 아이콘 옆에 붙는 개수를 상한까지만 보여준다.
 * 100부터는 "99+"로 접어, 숫자가 아무리 커져도 폭이 세 글자를 넘지 않는다.
 */
export function formatCappedCount(count: number, max: number = COUNT_BADGE_MAX): string {
  return count > max ? `${max}+` : `${count}`;
}

/** 퍼센트 값을 소수점 첫째 자리까지 반올림하여 포맷한다. 정수면 소수점 생략. */
export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded.toFixed(1)}`;
}

export function formatPrice(amount: number, currencyCode: string) {
  return new Intl.NumberFormat(getLocaleForCurrency(currencyCode), {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currencyCode) ? 0 : 2,
  }).format(amount);
}
