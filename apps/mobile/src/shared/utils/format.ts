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

export function formatPrice(amount: number, currencyCode: string) {
  return new Intl.NumberFormat(getLocaleForCurrency(currencyCode), {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currencyCode) ? 0 : 2,
  }).format(amount);
}
