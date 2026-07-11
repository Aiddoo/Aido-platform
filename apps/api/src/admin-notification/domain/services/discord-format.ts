/**
 * Discord 메시지 포맷 순수 함수.
 */

/**
 * ISO 날짜 문자열을 Discord 타임스탬프 포맷으로 변환한다.
 */
export function formatDate(isoString: string): string {
	try {
		const unixSeconds = Math.floor(new Date(isoString).getTime() / 1000);
		return `<t:${unixSeconds}:f>`;
	} catch {
		return isoString;
	}
}

/**
 * 금액을 통화 포맷으로 변환한다. 알 수 없는 통화 코드는 숫자만 표시한다.
 */
export function formatPrice(price: number, currency?: string): string {
	if (currency) {
		try {
			return new Intl.NumberFormat("ko-KR", {
				style: "currency",
				currency,
			}).format(price);
		} catch {
			// 알 수 없는 통화 코드인 경우 fallback
		}
	}
	return `${price.toLocaleString("ko-KR")}`;
}
