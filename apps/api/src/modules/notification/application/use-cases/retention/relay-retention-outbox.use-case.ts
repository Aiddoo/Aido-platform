import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";

import { decideRetentionOutboxRetry } from "../../policies/retention/retention-outbox-retry.policy.js";
import { type RetentionConfigPort } from "../../ports/retention/retention-config.port.js";
import { type RetentionJobEnqueuerPort } from "../../ports/retention/retention-job-enqueuer.port.js";
import { type RetentionRepositoryPort } from "../../ports/retention/retention.repository.port.js";

const OUTBOX_RELAY_BATCH_SIZE = 25;
const OUTBOX_PROCESSING_LEASE_MS = 15 * 60_000;

interface RelayRetentionOutboxDependencies {
  readonly repository: RetentionRepositoryPort;
  readonly enqueuer: RetentionJobEnqueuerPort;
  readonly config: RetentionConfigPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

export class RelayRetentionOutbox {
  readonly #dependencies: RelayRetentionOutboxDependencies;

  constructor(dependencies: RelayRetentionOutboxDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    if (!this.#dependencies.config.enabled) return;
    const now = new Date();
    const cutoff = new Date(now.getTime() - OUTBOX_PROCESSING_LEASE_MS);
    const claimed = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.repository.recoverStaleDispatches(cutoff);
      await this.#dependencies.repository.recoverStaleOutboxes(cutoff);
      return this.#dependencies.repository.claimOutboxes(OUTBOX_RELAY_BATCH_SIZE, now);
    });

    await Promise.all(
      claimed.map(async (outbox) => {
        try {
          await this.#dependencies.enqueuer.enqueueDispatch(outbox);
        } catch (error) {
          const normalizedError = error instanceof Error ? error : new Error(String(error));
          const retryDecision = decideRetentionOutboxRetry(outbox.attempts);
          await this.#dependencies.repository.markOutboxFailed({
            outboxId: outbox.id,
            publishAttempt: outbox.attempts,
            hasExhaustedRetries: retryDecision.hasExhaustedRetries,
            error: normalizedError.message,
            nextAttemptAt: new Date(Date.now() + retryDecision.delayMs),
          });
          this.#dependencies.logger.error(
            `Retention outbox publish failed: id=${outbox.id}`,
            normalizedError.stack,
          );
          return;
        }

        try {
          await this.#dependencies.repository.markOutboxPublished(outbox);
        } catch (error) {
          const normalizedError = error instanceof Error ? error : new Error(String(error));
          // enqueue 결과가 unknown이 아니므로 generation을 되돌리지 않는다. 이미 시작된
          // worker 또는 stale PROCESSING lease recovery가 같은 publication을 이어받는다.
          this.#dependencies.logger.error(
            `Retention outbox published-state write failed: id=${outbox.id}`,
            normalizedError.stack,
          );
          throw normalizedError;
        }
      }),
    );
  }
}
