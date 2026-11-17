import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { GrowthRetentionKey } from "../../domain/growth-metrics.constants.js";

/** 측정 시작(첫 활동 기록)과 종료 현지 날짜 기준 활동 사용자 수. 탈퇴 대기 사용자는 세지 않는다 */
export interface GrowthActivityReadModel {
  readonly measurementStartedAt: Temporal.Instant | null;
  readonly totalActiveUsers: number;
  readonly dau: number;
  readonly wau: number;
  readonly mau: number;
}

/** 가입 cohort 한 명과 그 사람 시간대의 가입·기준 현지 날짜, 리텐션 날짜의 활동 여부 */
export interface GrowthCohortSignupReadModel {
  readonly userId: UserId;
  readonly signedUpAt: Temporal.Instant;
  readonly signupLocalDate: Temporal.PlainDate;
  readonly asOfLocalDate: Temporal.PlainDate;
  readonly activeOn: Readonly<Record<GrowthRetentionKey, boolean>>;
}
