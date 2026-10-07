import {
  createRetentionNotificationMessage,
  type RetentionNotificationCopySelection,
} from "#api/modules/notification/notification-delivery.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";

import { RETENTION_CAMPAIGN_KEY } from "../../../domain/policies/retention/retention.constants.js";
import { retentionPushSkipReason } from "../../../domain/services/retention/push-eligibility.js";
import {
  decideRetentionStage,
  localDateString,
} from "../../../domain/services/retention/stage-policy.js";
import { type RetentionConfigPort } from "../../ports/retention/retention-config.port.js";
import {
  type RetentionRepositoryPort,
  type RetentionStageCandidate,
} from "../../ports/retention/retention.repository.port.js";

interface ProcessRetentionStagesDependencies {
  readonly repository: RetentionRepositoryPort;
  readonly config: RetentionConfigPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

export class ProcessRetentionStages {
  readonly #dependencies: ProcessRetentionStagesDependencies;

  constructor(dependencies: ProcessRetentionStagesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    if (!this.#dependencies.config.enabled) return;
    const candidates = await this.#dependencies.repository.findScheduledStages(200);
    for (const candidate of candidates) {
      try {
        await this.#processCandidate(candidate, new Date());
      } catch (error) {
        this.#dependencies.logger.error(
          `Retention stage failed: stageId=${candidate.stageId}, error=${error}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  async #processCandidate(candidate: RetentionStageCandidate, now: Date): Promise<void> {
    const returnedWithinWindow = Boolean(
      candidate.lastActiveAt &&
      localDateString(candidate.lastActiveAt, candidate.timezone) >
        localDateString(candidate.startedAt, candidate.timezone),
    );
    const activeToday = Boolean(
      candidate.lastActiveAt &&
      localDateString(candidate.lastActiveAt, candidate.timezone) ===
        localDateString(now, candidate.timezone),
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
    if (decision.kind === "WAIT") return;

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
          occurrenceKey: localDateString(now, candidate.timezone),
        },
      });
      await this.#dependencies.repository.createDelivery({
        stageId: candidate.stageId,
        userId: candidate.userId,
        timezone: candidate.timezone,
        title: message.title,
        body: message.body,
        route: decision.route,
        variantId: message.variantId,
      });
    });

    this.#dependencies.logger.debug(
      `Retention stage processed: campaign=${RETENTION_CAMPAIGN_KEY}, stage=${candidate.stage}, userId=${candidate.userId}`,
    );
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
