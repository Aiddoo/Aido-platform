import type { SignupStatsReadModel } from "../read-models/signup-stats.read-model.js";

export abstract class SignupStatsReaderPort {
  /** [start, end) 구간에 가입한 사용자의 가입 방식별 집계와 총 사용자 수를 돌려준다. */
  abstract getSignupStats(
    start: Temporal.Instant,
    end: Temporal.Instant,
  ): Promise<SignupStatsReadModel>;
}
