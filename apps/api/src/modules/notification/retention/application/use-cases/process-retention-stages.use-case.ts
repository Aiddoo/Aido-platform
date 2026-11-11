import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { localDateIn } from "#api/shared/domain/time/time-zone-name";

import { NotificationId } from "../../../inbox/domain/notification-id.vo.js";
import { type RetentionNotificationCopySelection } from "../../../push/application/messages/notification-copy-catalog.messages.js";
import { createRetentionNotificationMessage } from "../../../push/application/messages/retention-notification.messages.js";
import type { PublishNotificationUseCase } from "../../../push/application/use-cases/publish-notification.use-case.js";
import { retentionPushSkipReason } from "../../domain/push-eligibility.domain-service.js";
import { decideRetentionStage } from "../../domain/retention-stage.domain-service.js";
import {
  RETENTION_CAMPAIGN_KEY,
  RETENTION_EXPERIMENT_KEY,
} from "../../domain/retention.constants.js";
import type { RetentionConfigPort } from "../ports/retention-config.port.js";
import type { RetentionRepositoryPort } from "../ports/retention.repository.port.js";
import type {
  RetentionStageCandidate,
  RetentionStageCursor,
} from "../read-models/retention-stage-candidate.read-model.js";
import { NotificationRetentionLogEvent } from "../retention.log-events.js";

export const RETENTION_STAGE_SWEEP = {
  BATCH_SIZE: 200,
  // job 만료(5분) 안에 끝나도록 상한을 두고 남은 단계는 다음 실행이 이어 받는다
  MAX_BATCHES_PER_RUN: 10,
} as const;

interface ProcessRetentionStagesDependencies {
  readonly repository: Pick<
    RetentionRepositoryPort,
    | "findDueStages"
    | "linkStageNotification"
    | "markStageOutboxed"
    | "markStageSkipped"
    | "recordD7Result"
  >;
  readonly notificationPublisher: Pick<PublishNotificationUseCase, "publish">;
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
    let after: RetentionStageCursor | undefined;
    for (let batch = 0; batch < RETENTION_STAGE_SWEEP.MAX_BATCHES_PER_RUN; batch++) {
      const candidates = await this.#dependencies.repository.findDueStages({
        dueAt,
        ...(after != null && { after }),
        limit: RETENTION_STAGE_SWEEP.BATCH_SIZE,
      });
      for (const candidate of candidates) {
        await this.#processSafely(candidate);
      }
      const last = candidates.at(-1);
      if (candidates.length < RETENTION_STAGE_SWEEP.BATCH_SIZE || last == null) {
        return;
      }
      // 실패해 SCHEDULED로 남은 단계를 이번 실행에서 다시 읽지 않도록 위치로 이어 읽는다
      after = { createdAt: last.stageCreatedAt, stageId: last.stageId };
    }
  }

  async #processSafely(candidate: RetentionStageCandidate): Promise<void> {
    try {
      await this.#processCandidate(candidate, this.#now());
    } catch {
      this.#dependencies.logger.error({
        event: NotificationRetentionLogEvent.PROCESS_RETENTION_STAGES_STAGE_FAILED,
        stageId: candidate.stageId,
        errorType: "stage-processing",
      });
    }
  }

  #now(): Temporal.Instant {
    return this.#dependencies.clock.now();
  }

  async #processCandidate(
    candidate: RetentionStageCandidate,
    now: Temporal.Instant,
  ): Promise<void> {
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
      await this.#dependencies.repository.markStageSkipped(candidate.stageId, "CONTROL_GROUP", now);
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

    await this.#dependencies.unitOfWork.run(async () => {
      if (candidate.stage === "D7") {
        await this.#dependencies.repository.recordD7Result({
          assignmentId: candidate.assignmentId,
          returnedWithinD7: returnedWithinWindow,
          todoActionWithinD7: candidate.todoActionWithinWindow,
          measuredAt: now,
        });
      }

      if (candidate.variant === "CONTROL") {
        await this.#dependencies.repository.markStageSkipped(
          candidate.stageId,
          "CONTROL_MEASUREMENT_COMPLETE",
          now,
        );
        return;
      }
      if (decision.kind === "SKIP" || decision.kind === "EVALUATE_ONLY") {
        await this.#dependencies.repository.markStageSkipped(
          candidate.stageId,
          decision.reason,
          now,
        );
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
        await this.#dependencies.repository.markStageSkipped(candidate.stageId, skipReason, now);
        return;
      }

      const message = createRetentionNotificationMessage({
        ...resolveRetentionNotificationSelection(candidate.stage, decision.variantId),
        locale: candidate.locale,
        selectionContext: {
          recipientId: candidate.userId,
          occurrenceKey: localDateIn(now, candidate.timezone).toString(),
        },
      });
      if (!(await this.#dependencies.repository.markStageOutboxed(candidate.stageId, now))) {
        return;
      }
      const notification = await this.#dependencies.notificationPublisher.publish({
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
        await this.#dependencies.repository.linkStageNotification(
          candidate.stageId,
          NotificationId.reconstitute(notification.id),
          now,
        );
      }
    });

    this.#dependencies.logger.debug({
      event: NotificationRetentionLogEvent.PROCESS_RETENTION_STAGES_STAGE_PROCESSED,
      campaignKey: RETENTION_CAMPAIGN_KEY,
      stage: candidate.stage,
      userId: candidate.userId,
    });
  }
}

function resolveRetentionNotificationSelection(
  stage: RetentionStageCandidate["stage"],
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

  throw new Error(`Invalid retention notification selection: ${stage}:${variantId}`);
}
