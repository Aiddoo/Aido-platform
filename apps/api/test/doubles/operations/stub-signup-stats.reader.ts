import {
  type SignupStats,
  SignupStatsReaderPort,
} from "#api/modules/operations/admin-notices/application/ports/signup-stats.reader.port";

// 요청받은 집계 기간을 기록하고 정해 둔 통계를 돌려준다. 실패를 주면 조회 실패를 흉내 낸다
export class StubSignupStatsReader extends SignupStatsReaderPort {
  readonly requests: { start: Temporal.Instant; end: Temporal.Instant }[] = [];
  result: SignupStats | Error = { signupsByProvider: [], totalUsers: 0 };

  async getSignupStats(start: Temporal.Instant, end: Temporal.Instant): Promise<SignupStats> {
    this.requests.push({ start, end });
    if (this.result instanceof Error) {
      throw this.result;
    }
    return this.result;
  }
}
