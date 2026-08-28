import { Inject, Injectable, Logger } from "@nestjs/common";

import { PUSH_PROVIDER, type PushProvider } from "../../ports/push-provider.port";
import {
	PUSH_RECEIPT_REPOSITORY,
	type PushReceiptRepositoryPort,
} from "../../ports/push-receipt.repository.port";
import {
	PUSH_TOKEN_REPOSITORY,
	type PushTokenRepositoryPort,
} from "../../ports/push-token.repository.port";

const PUSH_RECEIPT_BATCH_SIZE = 900;

@Injectable()
export class ReconcilePushReceiptsUseCase {
	readonly #logger = new Logger(ReconcilePushReceiptsUseCase.name);

	constructor(
		@Inject(PUSH_RECEIPT_REPOSITORY)
		private readonly pushReceiptRepository: PushReceiptRepositoryPort,
		@Inject(PUSH_TOKEN_REPOSITORY)
		private readonly pushTokenRepository: PushTokenRepositoryPort,
		@Inject(PUSH_PROVIDER) private readonly pushProvider: PushProvider,
	) {}

	async execute(): Promise<void> {
		const pendingReceipts =
			await this.pushReceiptRepository.findPendingPushReceipts(PUSH_RECEIPT_BATCH_SIZE);
		if (pendingReceipts.length === 0) return;

		const receipts = await this.pushProvider.getReceipts(
			pendingReceipts.map((attempt) => attempt.ticketId),
		);
		const invalidTokens = await this.pushReceiptRepository.recordPushReceipts(receipts);
		if (invalidTokens.length > 0) {
			await this.pushTokenRepository.deactivateInvalidTokens(invalidTokens);
		}
		this.#logger.log(
			`Expo receipts processed: requested=${pendingReceipts.length}, received=${receipts.length}, invalidTokens=${invalidTokens.length}`,
		);
	}
}
