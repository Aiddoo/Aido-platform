import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { RetentionAssignmentId } from "./retention-assignment-id.vo.js";
import { RETENTION_STAGE_NAMES, type RetentionVariant } from "./retention-assignments.constants.js";
import { retentionStageMissing } from "./retention-assignments.errors.js";
import type { RetentionD7Result } from "./retention-d7-result.vo.js";
import { RetentionStage, type RetentionStagePrimitives } from "./retention-stage.entity.js";

export interface RetentionAssignmentPrimitives {
  readonly id: string;
  readonly userId: string;
  readonly variant: RetentionVariant;
  readonly startedAt: Temporal.Instant | null;
  readonly stages: readonly RetentionStagePrimitives[];
}

// 저장소가 바뀐 행만 조건부로 쓰도록 넘기는 이번 변경이다. 단계 닫기는 SCHEDULED였던 행에만 반영된다
export type RetentionAssignmentChange =
  | { readonly kind: "ENROLLED" }
  | { readonly kind: "ACTIVATED" }
  | { readonly kind: "STAGE_CLOSED"; readonly stage: RetentionStage }
  | { readonly kind: "STAGE_LINKED"; readonly stage: RetentionStage }
  | { readonly kind: "D7_MEASURED"; readonly result: RetentionD7Result };

interface RetentionAssignmentProps {
  readonly userId: UserId;
  readonly variant: RetentionVariant;
  startedAt: Temporal.Instant | null;
  readonly stages: RetentionStage[];
}

/**
 * 한 사용자의 온보딩 리텐션 실험 배정. 시작하면(첫 활동) 네 단계를 함께 만든다.
 * 이미 배정된 사용자를 다시 등록해도 처음 배정·시작 여부를 바꾸지 않는다(저장이 false). 시작은 activate만 한다.
 */
export class RetentionAssignment extends AggregateRoot<
  RetentionAssignmentId,
  RetentionAssignmentProps
> {
  #changes: RetentionAssignmentChange[] = [];

  static create(params: {
    readonly id: RetentionAssignmentId;
    readonly userId: UserId;
    readonly variant: RetentionVariant;
    readonly startedAt: Temporal.Instant | null;
  }): RetentionAssignment {
    const { startedAt } = params;
    const assignment = new RetentionAssignment(params.id, {
      userId: params.userId,
      variant: params.variant,
      startedAt,
      stages: startedAt == null ? [] : scheduledStages(startedAt),
    });
    assignment.#changes.push({ kind: "ENROLLED" });
    return assignment;
  }

  static reconstitute(primitives: RetentionAssignmentPrimitives): RetentionAssignment {
    return new RetentionAssignment(RetentionAssignmentId.reconstitute(primitives.id), {
      userId: UserId.reconstitute(primitives.userId),
      variant: primitives.variant,
      startedAt: primitives.startedAt,
      stages: primitives.stages.map((stage) => RetentionStage.reconstitute(stage)),
    });
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get startedAt(): Temporal.Instant | null {
    return this.props.startedAt;
  }

  get stages(): readonly RetentionStage[] {
    return this.props.stages;
  }

  activate(startedAt: Temporal.Instant): boolean {
    if (this.props.startedAt != null) {
      return false;
    }
    this.props.startedAt = startedAt;
    this.props.stages.push(...scheduledStages(startedAt));
    this.#changes.push({ kind: "ACTIVATED" });
    return true;
  }

  skipStage(stageId: string, reason: string, now: Temporal.Instant): boolean {
    const stage = this.#stage(stageId);
    if (!stage.skip(reason, now)) {
      return false;
    }
    this.#changes.push({ kind: "STAGE_CLOSED", stage });
    return true;
  }

  outboxStage(stageId: string, now: Temporal.Instant): boolean {
    const stage = this.#stage(stageId);
    if (!stage.outbox(now)) {
      return false;
    }
    this.#changes.push({ kind: "STAGE_CLOSED", stage });
    return true;
  }

  linkStageNotification(stageId: string, notificationId: number, now: Temporal.Instant): void {
    const stage = this.#stage(stageId);
    stage.linkNotification(notificationId, now);
    this.#changes.push({ kind: "STAGE_LINKED", stage });
  }

  measureD7(result: RetentionD7Result): void {
    this.#changes.push({ kind: "D7_MEASURED", result });
  }

  // 처리가 실패해 저장하지 못한 변경을 버린다
  discardChanges(): void {
    this.#changes = [];
  }

  // 저장소만 부른다. 꺼낸 변경은 다시 쓰지 않는다
  pullChanges(): RetentionAssignmentChange[] {
    const changes = this.#changes;
    this.#changes = [];
    return changes;
  }

  toPrimitives(): RetentionAssignmentPrimitives {
    return {
      id: this.id.value,
      userId: this.props.userId.value,
      variant: this.props.variant,
      startedAt: this.props.startedAt,
      stages: this.props.stages.map((stage) => stage.toPrimitives()),
    };
  }

  #stage(stageId: string): RetentionStage {
    const stage = this.props.stages.find((candidate) => candidate.id.value === stageId);
    if (stage == null) {
      throw retentionStageMissing(stageId);
    }
    return stage;
  }
}

function scheduledStages(startedAt: Temporal.Instant): RetentionStage[] {
  return RETENTION_STAGE_NAMES.map((stage) => RetentionStage.create({ stage, now: startedAt }));
}
