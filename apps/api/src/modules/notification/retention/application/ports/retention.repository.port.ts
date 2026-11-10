import type { RetentionStageName, RetentionVariant } from "../../domain/retention.constants.js";

export const RETENTION_REPOSITORY = Symbol("RETENTION_REPOSITORY");

export interface RetentionStageCandidate {
  readonly assignmentId: string;
  readonly stageId: string;
  readonly userId: string;
  readonly variant: RetentionVariant;
  readonly stage: RetentionStageName;
  readonly startedAt: Date;
  readonly timezone: string;
  readonly locale: "ko" | "en";
  readonly pushEnabled: boolean;
  readonly nightPushEnabled: boolean;
  readonly marketingPushAgreedAt: Date | null;
  readonly activeTokenCount: number;
  readonly lastActiveAt: Date | null;
  readonly todoCount: number;
  readonly completedCount: number;
  readonly incompleteCount: number;
  readonly todoActionWithinWindow: boolean;
}

export interface RetentionRepositoryPort {
  enroll(input: {
    userId: string;
    variant: RetentionVariant;
    startedAt: Date | null;
  }): Promise<void>;
  activate(userId: string, startedAt: Date): Promise<boolean>;
  findScheduledStages(limit: number): Promise<RetentionStageCandidate[]>;
  markStageSkipped(stageId: string, reason: string): Promise<boolean>;
  /** 다른 실행이 먼저 처리한 단계면 false다. 발행과 같은 UNIT_OF_WORK 안에서 호출한다. */
  markStageOutboxed(stageId: string): Promise<boolean>;
  linkStageNotification(stageId: string, notificationId: number): Promise<void>;
  recordD7Result(input: {
    assignmentId: string;
    returnedWithinD7: boolean;
    todoActionWithinD7: boolean;
  }): Promise<void>;
}
