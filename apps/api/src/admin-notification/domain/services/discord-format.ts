/**
 * Discord 메시지 포맷 순수 함수.
 */

/**
 * ISO 날짜 문자열을 Discord 타임스탬프 포맷으로 변환한다.
 */
export function formatDate(isoString: string): string {
	try {
		const time = new Date(isoString).getTime();
		// new Date(잘못된 문자열)은 예외 대신 Invalid Date(NaN)를 반환하므로 명시적으로 가드한다.
		if (Number.isNaN(time)) {
			return isoString;
		}
		const unixSeconds = Math.floor(time / 1000);
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
