import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { localDateInTimezone } from "#api/shared/domain/date/utils/timezone";

import {
  RETENTION_CAMPAIGN_KEY,
  RETENTION_EXPERIMENT_KEY,
} from "../../../domain/policies/retention/retention.constants.js";
import { retentionPushSkipReason } from "../../../domain/services/retention/push-eligibility.js";
import { decideRetentionStage } from "../../../domain/services/retention/stage-policy.js";
import { type RetentionNotificationCopySelection } from "../../messages/delivery/notification-copy.types.js";
import { createRetentionNotificationMessage } from "../../messages/delivery/notification-messages.js";
import { NotificationRetentionLogEvent } from "../../observability/retention/notification-retention-log.events.js";
import { type RetentionConfigPort } from "../../ports/retention/retention-config.port.js";
import {
  type RetentionRepositoryPort,
  type RetentionStageCandidate,
} from "../../ports/retention/retention.repository.port.js";
import type { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";

interface ProcessRetentionStagesDependencies {
  readonly repository: Pick<
    RetentionRepositoryPort,
    | "findScheduledStages"
    | "linkStageNotification"
    | "markStageOutboxed"
    | "markStageSkipped"
    | "recordD7Result"
  >;
  readonly notificationPublisher: Pick<NotificationPublisher, "publish">;
  readonly config: Pick<RetentionConfigPort, "enabled">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly logger: Pick<ApplicationLogger, "debug" | "error">;
}

export class ProcessRetentionStages {
  readonly #dependencies: ProcessRetentionStagesDependencies;

  constructor(dependencies: ProcessRetentionStagesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    if (!this.#dependencies.config.enabled) {
      return;
    }
    const candidates = await this.#dependencies.repository.findScheduledStages(200);
    for (const candidate of candidates) {
      try {
        await this.#processCandidate(candidate, now());
      } catch {
        this.#dependencies.logger.error({
          event: NotificationRetentionLogEvent.PROCESS_RETENTION_STAGES_STAGE_FAILED,
          stageId: candidate.stageId,
          errorType: "stage-processing",
        });
      }
    }
  }

  async #processCandidate(candidate: RetentionStageCandidate, now: Date): Promise<void> {
    const returnedWithinWindow = Boolean(
      candidate.lastActiveAt &&
      localDateInTimezone(candidate.lastActiveAt, candidate.timezone) >
        localDateInTimezone(candidate.startedAt, candidate.timezone),
    );
    const activeToday = Boolean(
      candidate.lastActiveAt &&
      localDateInTimezone(candidate.lastActiveAt, candidate.timezone) ===
        localDateInTimezone(now, candidate.timezone),
    );

    if (candidate.variant === "CONTROL" && candidate.stage !== "D7") {
      await this.#dependencies.repository.markStageSkipped(candidate.stageId, "CONTROL_GROUP");
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
        });
      }

      if (candidate.variant === "CONTROL") {
        await this.#dependencies.repository.markStageSkipped(
          candidate.stageId,
          "CONTROL_MEASUREMENT_COMPLETE",
        );
        return;
      }
      if (decision.kind === "SKIP" || decision.kind === "EVALUATE_ONLY") {
        await this.#dependencies.repository.markStageSkipped(candidate.stageId, decision.reason);
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
        await this.#dependencies.repository.markStageSkipped(candidate.stageId, skipReason);
        return;
      }

      const message = createRetentionNotificationMessage({
        ...resolveRetentionNotificationSelection(candidate.stage, decision.variantId),
        locale: candidate.locale,
        selectionContext: {
          recipientId: candidate.userId,
          occurrenceKey: localDateInTimezone(now, candidate.timezone),
        },
      });
      if (!(await this.#dependencies.repository.markStageOutboxed(candidate.stageId))) {
        return;
      }
      const notification = await this.#dependencies.notificationPublisher.publish({
        userId: candidate.userId,
        type: "SYSTEM_NOTICE",
        title: message.title,
        body: message.body,
        action: { type: "DEEP_LINK", url: decision.route },
        campaignKey: RETENTION_CAMPAIGN_KEY,
        variantId: message.variantId,
        purpose: "ENGAGEMENT",
        metadata: { retentionExperiment: RETENTION_EXPERIMENT_KEY },
      });
      if (notification != null) {
        await this.#dependencies.repository.linkStageNotification(
          candidate.stageId,
          notification.id,
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
