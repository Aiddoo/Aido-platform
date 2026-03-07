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
