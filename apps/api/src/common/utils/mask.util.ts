/**
 * 로깅/관측성용 마스킹 유틸
 *
 * 운영 로그에 PII(개인식별정보)가 평문 노출되지 않도록 감싸는 순수 함수 모음.
 * 이 파일은 외부 의존성 없이 단일 책임만 가진다 — "문자열을 로그 안전 형태로 변환".
 *
 * OWASP A09:2021 (Security Logging and Monitoring Failures) 대응.
 */

/**
 * 이메일을 로그 안전 형태로 마스킹.
 *
 * @example maskEmail("yongmin@crabit.co.kr") → "y***@crabit.co.kr"
 * @example maskEmail("a@b.com")              → "a***@b.com"
 * @example maskEmail("invalid")              → "<invalid>"
 */
export function maskEmail(email: string): string {
	if (!email?.includes("@")) {
		return "<invalid>";
	}
	const [local, domain] = email.split("@");
	if (!local) {
		return `***@${domain}`;
	}
	return `${local[0]}***@${domain}`;
}

/**
 * 사용자 ID(cuid)를 로그 안전 형태로 마스킹.
 *
 * cuid 는 비인증적(non-auth) 식별자이지만 노출 표면적을 줄이기 위해 앞 6자만 남김.
 * 운영 디버깅 시에는 DB 에서 prefix 로 조회 가능.
 *
 * @example maskUserId("cmmxmf9tx000f1ysse29t7981") → "cmmxmf…"
 */
export function maskUserId(userId: string): string {
	if (!userId) {
		return "<empty>";
	}
	if (userId.length <= 6) {
		return `${userId}…`;
	}
	return `${userId.slice(0, 6)}…`;
}
