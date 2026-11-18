import { Entity } from "#api/shared/domain/model/entity";

import type {
  RetentionStageName,
  RetentionStageStatus,
} from "./retention-assignments.constants.js";
import { RetentionStageId } from "./retention-stage-id.vo.js";

export interface RetentionStagePrimitives {
  readonly id: string;
  readonly stage: RetentionStageName;
  readonly status: RetentionStageStatus;
  readonly skipReason: string | null;
  readonly processedAt: Temporal.Instant | null;
  readonly notificationId: number | null;
  readonly updatedAt: Temporal.Instant;
}

interface RetentionStageProps {
  readonly stage: RetentionStageName;
  status: RetentionStageStatus;
  skipReason: string | null;
  processedAt: Temporal.Instant | null;
  notificationId: number | null;
  updatedAt: Temporal.Instant;
}

// 배정 하나의 D0·D1·D3·D7 발송 단계. SCHEDULED에서 한 번만 닫히고(건너뜀·발행) 배정을 거쳐서만 바뀐다
export class RetentionStage extends Entity<RetentionStageId, RetentionStageProps> {
  static create(params: {
    readonly stage: RetentionStageName;
    readonly now: Temporal.Instant;
  }): RetentionStage {
    return new RetentionStage(RetentionStageId.generate(), {
      stage: params.stage,
      status: "SCHEDULED",
      skipReason: null,
      processedAt: null,
      notificationId: null,
      updatedAt: params.now,
    });
  }

  static reconstitute(primitives: RetentionStagePrimitives): RetentionStage {
    return new RetentionStage(RetentionStageId.reconstitute(primitives.id), {
      stage: primitives.stage,
      status: primitives.status,
      skipReason: primitives.skipReason,
      processedAt: primitives.processedAt,
      notificationId: primitives.notificationId,
      updatedAt: primitives.updatedAt,
    });
  }

  get stage(): RetentionStageName {
    return this.props.stage;
  }

  get status(): RetentionStageStatus {
    return this.props.status;
  }

  skip(reason: string, now: Temporal.Instant): boolean {
    if (this.props.status !== "SCHEDULED") {
      return false;
    }
    this.props.status = "SKIPPED";
    this.props.skipReason = reason;
    this.props.processedAt = now;
    this.props.updatedAt = now;
    return true;
  }

  outbox(now: Temporal.Instant): boolean {
    if (this.props.status !== "SCHEDULED") {
      return false;
    }
    this.props.status = "OUTBOXED";
    this.props.processedAt = now;
    this.props.updatedAt = now;
    return true;
  }

  linkNotification(notificationId: number, now: Temporal.Instant): void {
    this.props.notificationId = notificationId;
    this.props.updatedAt = now;
  }

  toPrimitives(): RetentionStagePrimitives {
    return {
      id: this.id.value,
      stage: this.props.stage,
      status: this.props.status,
      skipReason: this.props.skipReason,
      processedAt: this.props.processedAt,
      notificationId: this.props.notificationId,
      updatedAt: this.props.updatedAt,
    };
  }
}
