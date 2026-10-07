import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { type PushProvider } from "../../ports/delivery/push-provider.port.js";
import { type PushReceiptRepositoryPort } from "../../ports/delivery/push-receipt.repository.port.js";
import { type PushTokenRepositoryPort } from "../../ports/delivery/push-token.repository.port.js";

const PUSH_RECEIPT_BATCH_SIZE = 900;

interface ReconcilePushReceiptsDependencies {
  readonly pushReceiptRepository: PushReceiptRepositoryPort;
  readonly pushTokenRepository: PushTokenRepositoryPort;
  readonly pushProvider: PushProvider;
  readonly logger: ApplicationLogger;
}

export class ReconcilePushReceipts {
  readonly #dependencies: ReconcilePushReceiptsDependencies;

  constructor(dependencies: ReconcilePushReceiptsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    const pendingReceipts =
      await this.#dependencies.pushReceiptRepository.findPendingPushReceipts(
        PUSH_RECEIPT_BATCH_SIZE,
      );
    if (pendingReceipts.length === 0) return;

    const receipts = await this.#dependencies.pushProvider.getReceipts(
      pendingReceipts.map((attempt) => attempt.ticketId),
    );
    const invalidTokens =
      await this.#dependencies.pushReceiptRepository.recordPushReceipts(receipts);
    if (invalidTokens.length > 0) {
      await this.#dependencies.pushTokenRepository.deactivateInvalidTokens(invalidTokens);
    }
    this.#dependencies.logger.log(
      `Expo receipts processed: requested=${pendingReceipts.length}, received=${receipts.length}, invalidTokens=${invalidTokens.length}`,
    );
  }
}
