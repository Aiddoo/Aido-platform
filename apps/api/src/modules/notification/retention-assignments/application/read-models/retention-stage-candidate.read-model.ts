import type { SupportedLocale } from "@aido/api/vocabulary";

import type {
  RetentionStageName,
  RetentionVariant,
} from "../../domain/retention-assignments.constants.js";

export interface RetentionStageCandidateReadModel {
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
export interface RetentionStageCursorReadModel {
  readonly createdAt: Temporal.Instant;
  readonly stageId: string;
}
