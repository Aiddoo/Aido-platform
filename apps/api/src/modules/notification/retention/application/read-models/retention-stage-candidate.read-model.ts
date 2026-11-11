import type { SupportedLocale } from "#api/shared/domain/locale";

import type { RetentionStageName, RetentionVariant } from "../../domain/retention.constants.js";

export interface RetentionStageCandidate {
  readonly assignmentId: string;
  readonly stageId: string;
  readonly stageCreatedAt: Temporal.Instant;
  readonly userId: string;
  readonly variant: RetentionVariant;
  readonly stage: RetentionStageName;
  readonly startedAt: Temporal.Instant;
  readonly timezone: string;
  readonly locale: SupportedLocale;
  readonly pushEnabled: boolean;
  readonly nightPushEnabled: boolean;
  readonly marketingPushAgreedAt: Temporal.Instant | null;
  readonly activeTokenCount: number;
  readonly lastActiveAt: Temporal.Instant | null;
  readonly todoCount: number;
  readonly completedCount: number;
  readonly incompleteCount: number;
  readonly todoActionWithinWindow: boolean;
}

// 한 실행 안에서 다음 묶음을 이어 읽는 위치(단계 생성 순서)
export interface RetentionStageCursor {
  readonly createdAt: Temporal.Instant;
  readonly stageId: string;
}
