import { uniqBy } from "es-toolkit";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { localDateIn } from "#api/shared/domain/time/time-zone-name";

import type { PublishNotificationUseCase } from "../../../notifications/notification-notifications.public.js";
import { type RetentionNotificationCopySelection } from "../../../shared/application/messages/notification-copy-catalog.messages.js";
import { createRetentionNotificationMessage } from "../../../shared/application/messages/retention-notification.messages.js";
import { retentionPushSkipReason } from "../../domain/push-eligibility.domain-service.js";
import { RetentionAssignmentId } from "../../domain/retention-assignment-id.vo.js";
import type { RetentionAssignment } from "../../domain/retention-assignment.aggregate.js";
import {
  RETENTION_CAMPAIGN_KEY,
  RETENTION_EXPERIMENT_KEY,
} from "../../domain/retention-assignments.constants.js";
import { RetentionD7Result } from "../../domain/retention-d7-result.vo.js";
import {
  decideRetentionStage,
  type RetentionStageDecision,
} from "../../domain/retention-stage.domain-service.js";
import type { RetentionAssignmentRepositoryPort } from "../ports/retention-assignment.repository.port.js";
import type { RetentionConfigPort } from "../ports/retention-config.port.js";
import type {
  RetentionStageCandidateReadModel,
  RetentionStageCursorReadModel,
} from "../read-models/retention-stage-candidate.read-model.js";
import { invalidRetentionNotificationSelection } from "../retention-assignments.errors.js";
import { RetentionAssignmentLogEvent } from "../retention-assignments.log-events.js";

export const RETENTION_STAGE_SWEEP = {
  BATCH_SIZE: 200,
  // job 만료(5분) 안에 끝나도록 상한을 두고 남은 단계는 다음 실행이 이어 받는다
  MAX_BATCHES_PER_RUN: 10,
} as const;

interface ProcessRetentionStagesDependencies {
  readonly repository: Pick<
    RetentionAssignmentRepositoryPort,
    "listByIds" | "listDueStages" | "save"
  >;
  readonly notificationPublisher: Pick<PublishNotificationUseCase, "execute">;
  readonly config: Pick<RetentionConfigPort, "enabled">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "debug" | "error">;
}

export class ProcessRetentionStagesUseCase {
  readonly #dependencies: ProcessRetentionStagesDependencies;

  constructor(dependencies: ProcessRetentionStagesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    if (!this.#dependencies.config.enabled) {
      return;
    }
    const dueAt = this.#now();
    let after: RetentionStageCursorReadModel | undefined;
    for (let batch = 0; batch < RETENTION_STAGE_SWEEP.MAX_BATCHES_PER_RUN; batch++) {
      const candidates = await this.#dependencies.repository.listDueStages({
        dueAt,
        ...(after != null && { after }),
        limit: RETENTION_STAGE_SWEEP.BATCH_SIZE,
      });
      const assignments = await this.#dependencies.repository.listByIds(
        uniqBy(candidates, (candidate) => candidate.assignmentId).map((candidate) =>
          RetentionAssignmentId.reconstitute(candidate.assignmentId),
        ),
      );
      for (const candidate of candidates) {
        const assignment = assignments.get(candidate.assignmentId);
        if (assignment != null) {
          await this.#processSafely(candidate, assignment);
        }
      }
      const last = candidates.at(-1);
      if (candidates.length < RETENTION_STAGE_SWEEP.BATCH_SIZE || last == null) {
        return;
      }
      // 실패해 SCHEDULED로 남은 단계를 이번 실행에서 다시 읽지 않도록 위치로 이어 읽는다
      after = { createdAt: last.stageCreatedAt, stageId: last.stageId };
    }
  }

  async #processSafely(
    candidate: RetentionStageCandidateReadModel,
    assignment: RetentionAssignment,
  ): Promise<void> {
    try {
      await this.#processCandidate(candidate, assignment, this.#now());
    } catch {
      // 롤백된 변경(D7 측정 등)이 같은 배정의 다음 단계 저장에 섞이지 않게 버린다
      assignment.discardChanges();
      this.#dependencies.logger.error({
        event: RetentionAssignmentLogEvent.PROCESS_RETENTION_STAGES_STAGE_FAILED,
        stageId: candidate.stageId,
        errorType: "stage-processing",
      });
    }
  }

  #now(): Temporal.Instant {
    return this.#dependencies.clock.now();
  }

  async #processCandidate(
    candidate: RetentionStageCandidateReadModel,
    assignment: RetentionAssignment,
    now: Temporal.Instant,
  ): Promise<void> {
    const { repository } = this.#dependencies;
    const { lastActiveAt, startedAt, timezone } = candidate;
    const returnedWithinWindow =
      lastActiveAt != null &&
      Temporal.PlainDate.compare(
        localDateIn(lastActiveAt, timezone),
        localDateIn(startedAt, timezone),
      ) > 0;
    const activeToday =
      lastActiveAt != null &&
      localDateIn(lastActiveAt, timezone).equals(localDateIn(now, timezone));

    if (candidate.variant === "CONTROL" && candidate.stage !== "D7") {
      assignment.skipStage(candidate.stageId, "CONTROL_GROUP", now);
      await repository.save(assignment);
      return;
    }

    const decision = decideRetentionStage(candidate.stage, {
      startedAt: candidate.startedAt,
      now,
      timezone: candidate.timezone,
      todoCount: candidate.todoCount,
      completedCount: candidate.completedCount,
      incompleteCount: candidate.incompleteCount,
      returnedWithinWindow,
      todoActionWithinWindow: candidate.todoActionWithinWindow,
      activeToday,
    });
    if (decision.kind === "WAIT") {
      return;
    }

    await this.#dependencies.unitOfWork.run(() =>
      this.#settleStage(candidate, assignment, { decision, returnedWithinWindow, now }),
    );

    this.#dependencies.logger.debug({
      event: RetentionAssignmentLogEvent.PROCESS_RETENTION_STAGES_STAGE_PROCESSED,
      campaignKey: RETENTION_CAMPAIGN_KEY,
      stage: candidate.stage,
      userId: candidate.userId,
    });
  }

  async #settleStage(
    candidate: RetentionStageCandidateReadModel,
    assignment: RetentionAssignment,
    {
      decision,
      returnedWithinWindow,
      now,
    }: {
      readonly decision: Exclude<RetentionStageDecision, { readonly kind: "WAIT" }>;
      readonly returnedWithinWindow: boolean;
      readonly now: Temporal.Instant;
    },
  ): Promise<void> {
    const { repository } = this.#dependencies;
    if (candidate.stage === "D7") {
      assignment.measureD7(
        RetentionD7Result.create({
          returnedWithinD7: returnedWithinWindow,
          todoActionWithinD7: candidate.todoActionWithinWindow,
          measuredAt: now,
        }),
      );
    }

    if (candidate.variant === "CONTROL") {
      assignment.skipStage(candidate.stageId, "CONTROL_MEASUREMENT_COMPLETE", now);
      await repository.save(assignment);
      return;
    }
    if (decision.kind === "SKIP" || decision.kind === "EVALUATE_ONLY") {
      assignment.skipStage(candidate.stageId, decision.reason, now);
      await repository.save(assignment);
      return;
    }

    const skipReason = retentionPushSkipReason({
      pushEnabled: candidate.pushEnabled,
      marketingPushAgreedAt: candidate.marketingPushAgreedAt,
      activeTokenCount: candidate.activeTokenCount,
      timezone: candidate.timezone,
      now,
    });
    if (skipReason) {
      assignment.skipStage(candidate.stageId, skipReason, now);
      await repository.save(assignment);
      return;
    }
    await this.#publishStage(candidate, assignment, { decision, now });
  }

  async #publishStage(
    candidate: RetentionStageCandidateReadModel,
    assignment: RetentionAssignment,
    {
      decision,
      now,
    }: {
      readonly decision: Extract<RetentionStageDecision, { readonly kind: "SEND" }>;
      readonly now: Temporal.Instant;
    },
  ): Promise<void> {
    const { repository } = this.#dependencies;
    const message = createRetentionNotificationMessage({
      ...resolveRetentionNotificationSelection(candidate.stage, decision.variantId),
      locale: candidate.locale,
      selectionContext: {
        recipientId: candidate.userId,
        occurrenceKey: localDateIn(now, candidate.timezone).toString(),
      },
    });
    // 읽을 때 이미 닫혀 있거나(다른 실행이 먼저 발행) 저장에서 경쟁을 지면 발행하지 않는다.
    // D7 측정은 그래도 남긴다(옛 기록 순서와 같다)
    const isClaimed = assignment.outboxStage(candidate.stageId, now);
    const isSaved = await repository.save(assignment);
    if (!isClaimed || !isSaved) {
      return;
    }
    const notification = await this.#dependencies.notificationPublisher.execute({
      userId: candidate.userId,
      type: "SYSTEM_NOTICE",
      title: message.title,
      body: message.body,
      // 리텐션 선택의 copyKey(단계별 문구 묶음)와 달리 알림함을 다시 그릴 카탈로그 키다
      copyKey: message.copyKey,
      copyFacts: message.copyFacts,
      action: { type: "DEEP_LINK", url: decision.route },
      campaignKey: RETENTION_CAMPAIGN_KEY,
      variantId: message.variantId,
      purpose: "ENGAGEMENT",
      metadata: { retentionExperiment: RETENTION_EXPERIMENT_KEY },
    });
    if (notification != null) {
      assignment.linkStageNotification(candidate.stageId, notification.id, now);
      await repository.save(assignment);
    }
  }
}

function resolveRetentionNotificationSelection(
  stage: RetentionStageCandidateReadModel["stage"],
  variantId: string,
): RetentionNotificationCopySelection {
  if (stage === "D0" && variantId === "d0_no_todo") {
    return { stage, copyKey: variantId };
  }
  if (stage === "D1" && (variantId === "d1_no_todo" || variantId === "d1_has_todo_no_completion")) {
    return { stage, copyKey: variantId };
  }
  if (stage === "D3" && variantId === "d3_restart") {
    return { stage, copyKey: variantId };
  }
  if (stage === "D7" && (variantId === "d7_has_progress" || variantId === "d7_restart")) {
    return { stage, copyKey: variantId };
  }

  throw invalidRetentionNotificationSelection(stage, variantId);
}
