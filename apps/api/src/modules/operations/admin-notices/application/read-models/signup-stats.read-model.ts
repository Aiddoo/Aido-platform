/** 일일 가입 요약에 필요한 가입 방식별 가입자 수와 총 사용자 수 */
export interface SignupStatsReadModel {
  readonly signupsByProvider: ReadonlyArray<{ readonly provider: string; readonly count: number }>;
  readonly totalUsers: number;
}
