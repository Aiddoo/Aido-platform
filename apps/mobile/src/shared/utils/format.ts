const ZERO_DECIMAL_CURRENCIES = new Set(['KRW', 'JPY']);

export function formatPrice(amount: number, currencyCode: string) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currencyCode) ? 0 : 2,
  }).format(amount);
}
