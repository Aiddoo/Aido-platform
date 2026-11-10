/** 일일 가입 요약에 필요한 provider별 가입자 수와 총 사용자 수. provider는 DB enum이 아닌 문자열이다. */
export interface SignupStats {
  readonly signupsByProvider: ReadonlyArray<{ readonly provider: string; readonly count: number }>;
  readonly totalUsers: number;
}

export abstract class SignupStatsReaderPort {
  /** [start, end) 구간에 가입한 사용자의 provider별 집계와 총 사용자 수를 돌려준다. */
  abstract getSignupStats(start: Temporal.Instant, end: Temporal.Instant): Promise<SignupStats>;
}
