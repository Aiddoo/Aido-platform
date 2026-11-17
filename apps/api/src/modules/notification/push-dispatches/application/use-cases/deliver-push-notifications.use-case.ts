import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { pushDeliveryOutboxRetryDelayMs } from "../../domain/push-delivery-outbox-retry.domain-service.js";
import type {
  ClaimedPushDelivery,
  PushDeliveryClaimRepositoryPort,
} from "../ports/push-delivery-claim.repository.port.js";
import type { PushDeliveryLeaseRepositoryPort } from "../ports/push-delivery-lease.repository.port.js";
import { pushDeliveryClaimRecoveryConflict } from "../push-dispatches.errors.js";
import { PushDispatchLogEvent } from "../push-dispatches.log-events.js";
import type { PushDeliveryPublicationReadModel } from "../read-models/push-delivery.read-model.js";
import type { DeliverPushBatchUseCase } from "./deliver-push-batch.use-case.js";
import type { DeliverSinglePushUseCase } from "./deliver-single-push.use-case.js";

export interface DeliverPushNotificationsCommand {
  readonly publications: readonly PushDeliveryPublicationReadModel[];
  readonly processingJobId: string;
  readonly processingJobAttempt: number;
  readonly isFinalAttempt: boolean;
}

/**
 * Durable queue에서 claim한 일반 push를 기존 단건/배치 정책으로 전달한다.
 *
 * Expo가 ticket을 수락한 직후 프로세스가 종료되면 동일 알림이 재전달될 수 있다.
 * DB fence는 stale worker의 상태 덮어쓰기를 막지만 외부 provider까지 exactly-once로 만들지는 않는다.
 */
interface DeliverPushNotificationsDependencies {
  readonly claims: Pick<PushDeliveryClaimRepositoryPort, "claim" | "reopenAfterFinalClaimFailure">;
  readonly lease: Pick<PushDeliveryLeaseRepositoryPort, "release">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly deliverSingle: Pick<DeliverSinglePushUseCase, "execute">;
  readonly deliverBatch: Pick<DeliverPushBatchUseCase, "execute">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "error">;
}

export class DeliverPushNotificationsUseCase {
  readonly #dependencies: DeliverPushNotificationsDependencies;

  constructor(dependencies: DeliverPushNotificationsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: DeliverPushNotificationsCommand): Promise<void> {
    const claimed = await this.#claim(input);
    if (claimed.length === 0) {
      return;
    }

    try {
      for (const delivery of claimed.filter((item) => item.deliveryMode === "SINGLE")) {
        await this.#dependencies.deliverSingle.execute(delivery);
      }
      await this.#dependencies.deliverBatch.execute(
        claimed.filter((item) => item.deliveryMode === "BATCH"),
      );
    } catch (error) {
      await this.#release(claimed, error, input.isFinalAttempt);
      throw error;
    }
  }

  async #claim(input: DeliverPushNotificationsCommand): Promise<readonly ClaimedPushDelivery[]> {
    try {
      return await this.#dependencies.unitOfWork.run(() =>
        this.#dependencies.claims.claim({
          publications: input.publications,
          processingJobId: input.processingJobId,
          processingJobAttempt: input.processingJobAttempt,
          startedAt: this.#now(),
        }),
      );
    } catch (claimError) {
      if (input.isFinalAttempt) {
        await this.#recoverFinalClaimFailure(input, claimError);
      }
      throw claimError;
    }
  }

  async #recoverFinalClaimFailure(
    input: DeliverPushNotificationsCommand,
    claimError: unknown,
  ): Promise<void> {
    const message = claimError instanceof Error ? claimError.message : String(claimError);
    try {
      await this.#dependencies.unitOfWork.run(async () => {
        const recovered = await this.#dependencies.claims.reopenAfterFinalClaimFailure({
          publications: input.publications,
          availableAt: this.#now(),
          error: message,
        });
        if (recovered !== input.publications.length) {
          throw pushDeliveryClaimRecoveryConflict(input.publications.length, recovered);
        }
      });
    } catch {
      this.#dependencies.logger.error({
        event: PushDispatchLogEvent.DELIVER_PUSH_NOTIFICATIONS_CLAIM_RECOVERY_FAILED,
        dispatchCount: input.publications.length,
        errorType: "claim-recovery",
      });
    }
  }

  #now(): Temporal.Instant {
    return this.#dependencies.clock.now();
  }

  async #release(
    claimed: readonly ClaimedPushDelivery[],
    error: unknown,
    isFinalAttempt: boolean,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const at = this.#now();
    try {
      await this.#dependencies.unitOfWork.run(() =>
        this.#dependencies.lease.release(
          claimed.map((item) => ({
            fence: item.fence,
            error: message,
            reopenOutbox: isFinalAttempt,
            availableAt: at.add({
              milliseconds: isFinalAttempt
                ? pushDeliveryOutboxRetryDelayMs(item.fence.publishAttempt)
                : 0,
            }),
          })),
        ),
      );
    } catch {
      this.#dependencies.logger.error({
        event: PushDispatchLogEvent.DELIVER_PUSH_NOTIFICATIONS_LEASE_RELEASE_FAILED,
        dispatchCount: claimed.length,
        errorType: "lease-release",
      });
    }
  }
}
