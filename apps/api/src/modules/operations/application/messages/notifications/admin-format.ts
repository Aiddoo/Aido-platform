/**
 * 금액을 통화 포맷으로 변환한다. 알 수 없는 통화 코드는 숫자만 표시한다.
 */
export function formatPrice(price: number, currency?: string): string {
  if (currency) {
    try {
      return new Intl.NumberFormat("ko-KR", {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
      }).format(price);
    } catch {
      // 알 수 없는 통화 코드인 경우 fallback
    }
  }
  return `${price.toLocaleString("ko-KR")}`;
}
