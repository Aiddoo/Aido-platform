/**
 * 가입 통계 리더 포트.
 *
 * 일일 가입 요약 집계에 필요한 provider별 가입자 수·총 사용자 수를 조회한다.
 * 어댑터가 Prisma로 위임한다(도메인은 Prisma enum에 의존하지 않으므로 provider는 문자열).
 */
export interface SignupStats {
	signupsByProvider: Array<{ provider: string; count: number }>;
	totalUsers: number;
}

export interface SignupStatsReaderPort {
	/**
	 * [startUtc, endUtc) 구간에 가입한 사용자의 provider별 집계와 총 사용자 수를 반환한다.
	 */
	getSignupStats(startUtc: Date, endUtc: Date): Promise<SignupStats>;
}

export const SIGNUP_STATS_READER = Symbol("SIGNUP_STATS_READER");
