import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";

import { NotificationRetentionLogEvent } from "../../observability/retention/notification-retention-log.events.js";
import { decideRetentionOutboxRetry } from "../../policies/retention/retention-outbox-retry.policy.js";
import type { NotificationCachePort } from "../../ports/delivery/notification-cache.port.js";
import { type RetentionConfigPort } from "../../ports/retention/retention-config.port.js";
import { type RetentionPushSenderPort } from "../../ports/retention/retention-push-sender.port.js";
import { type RetentionRepositoryPort } from "../../ports/retention/retention.repository.port.js";

interface DispatchRetentionPushDependencies {
  readonly repository: Pick<
    RetentionRepositoryPort,
    | "claimDispatch"
    | "deferOutbox"
    | "markDispatchSkipped"
    | "markRateLimitReserved"
    | "recordDeliveryResults"
    | "releaseDispatchForRetry"
    | "reopenUnclaimedDispatch"
  >;
  readonly sender: Pick<RetentionPushSenderPort, "isEligible" | "reserveRateLimit" | "send">;
  readonly config: Pick<RetentionConfigPort, "enabled">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly cache: Pick<NotificationCachePort, "invalidatePushTokens">;
  readonly logger: Pick<ApplicationLogger, "error" | "warn">;
}

export class DispatchRetentionPush {
  readonly #dependencies: DispatchRetentionPushDependencies;

  constructor(dependencies: DispatchRetentionPushDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: {
    readonly outboxId: string;
    readonly publishAttempt?: number;
    readonly processingJobId: string;
    readonly processingJobAttempt: number;
    readonly isFinalAttempt: boolean;
  }): Promise<void> {
    if (!this.#dependencies.config.enabled) {
      await this.#dependencies.unitOfWork.run(() =>
        this.#dependencies.repository.deferOutbox({
          outboxId: input.outboxId,
          publishAttempt: input.publishAttempt,
          availableAt: new Date(Date.now() + 60_000),
        }),
      );
      return;
    }
    let candidate: Awaited<ReturnType<RetentionRepositoryPort["claimDispatch"]>>;
    try {
      candidate = await this.#dependencies.unitOfWork.run(() =>
        this.#dependencies.repository.claimDispatch({ ...input, startedAt: new Date() }),
      );
    } catch (claimError) {
      if (input.isFinalAttempt) await this.#recoverFinalClaimFailure(input, claimError);
      throw claimError;
    }
    if (candidate === null) return;
    try {
      const now = new Date();
      if (!this.#dependencies.sender.isEligible(candidate, now)) {
        await this.#dependencies.unitOfWork.run(() =>
          this.#dependencies.repository.markDispatchSkipped(
            candidate.fence,
            "INELIGIBLE_AT_DISPATCH",
          ),
        );
        return;
      }
      if (!candidate.rateLimitReserved) {
        if (!(await this.#dependencies.sender.reserveRateLimit(candidate, now))) {
          await this.#dependencies.unitOfWork.run(() =>
            this.#dependencies.repository.markDispatchSkipped(
              candidate.fence,
              "RATE_LIMITED_AT_DISPATCH",
            ),
          );
          return;
        }
        await this.#dependencies.unitOfWork.run(async () => {
          const reserved = await this.#dependencies.repository.markRateLimitReserved(
            candidate.fence,
            new Date(),
          );
          if (!reserved) throw new Error("Retention rate-limit reservation fence mismatch");
        });
      }
      const results = await this.#dependencies.sender.send(candidate);
      const finalized = await this.#dependencies.unitOfWork.run(() =>
        this.#dependencies.repository.recordDeliveryResults(candidate.fence, results),
      );
      if (finalized && results.some((result) => result.errorCode === "DeviceNotRegistered")) {
        // 캐시 실패로 이미 기록한 외부 발송을 재시도하지 않는다.
        try {
          await this.#dependencies.cache.invalidatePushTokens(candidate.userId);
        } catch {
          this.#dependencies.logger.warn({
            event: NotificationRetentionLogEvent.DISPATCH_RETENTION_PUSH_CACHE_SETTLE_FAILED,
            userId: candidate.userId,
            errorType: "cache-invalidation",
          });
        }
      }
    } catch (error) {
      const retry = decideRetentionOutboxRetry(candidate.fence.publishAttempt);
      await this.#dependencies.unitOfWork.run(() =>
        this.#dependencies.repository.releaseDispatchForRetry({
          fence: candidate.fence,
          reason: error instanceof Error ? error.message : String(error),
          availableAt: new Date(Date.now() + retry.delayMs),
          hasExhaustedRetries: retry.hasExhaustedRetries,
        }),
      );
      throw error;
    }
  }

  async #recoverFinalClaimFailure(
    input: { readonly outboxId: string; readonly publishAttempt?: number },
    claimError: unknown,
  ): Promise<void> {
    const reason = claimError instanceof Error ? claimError.message : String(claimError);
    try {
      await this.#dependencies.unitOfWork.run(async () => {
        const recovered = await this.#dependencies.repository.reopenUnclaimedDispatch({
          outboxId: input.outboxId,
          publishAttempt: input.publishAttempt,
          availableAt: new Date(),
          reason,
        });
        if (!recovered) throw new Error("Retention final claim recovery fence mismatch");
      });
    } catch {
      this.#dependencies.logger.error({
        event: NotificationRetentionLogEvent.DISPATCH_RETENTION_PUSH_CLAIM_RECOVERY_FAILED,
        outboxId: input.outboxId,
        errorType: "claim-recovery",
      });
    }
  }
}
