import { TestBed } from "@suites/unit";
import type { Mocked } from "vitest";

import { PUSH_PROVIDER, type PushProvider } from "../../ports/push-provider.port.js";
import {
	PUSH_RECEIPT_REPOSITORY,
	type PushReceiptRepositoryPort,
} from "../../ports/push-receipt.repository.port.js";
import {
	PUSH_TOKEN_REPOSITORY,
	type PushTokenRepositoryPort,
} from "../../ports/push-token.repository.port.js";
import { ReconcilePushReceiptsUseCase } from "./reconcile-push-receipts.use-case.js";

describe("ReconcilePushReceiptsUseCase", () => {
	it("records provider receipts and deactivates invalid tokens", async () => {
		const { unit, unitRef } = await TestBed.solitary(ReconcilePushReceiptsUseCase).compile();
		const receipts = unitRef.get<Mocked<PushReceiptRepositoryPort>>(PUSH_RECEIPT_REPOSITORY);
		const tokens = unitRef.get<Mocked<PushTokenRepositoryPort>>(PUSH_TOKEN_REPOSITORY);
		const provider = unitRef.get<Mocked<PushProvider>>(PUSH_PROVIDER);
		receipts.findPendingPushReceipts.mockResolvedValue([
			{ ticketId: "ticket-1", token: "token-1" },
		]);
		provider.getReceipts.mockResolvedValue([{ ticketId: "ticket-1", delivered: false }]);
		receipts.recordPushReceipts.mockResolvedValue(["token-1"]);

		await unit.execute();

		expect(receipts.findPendingPushReceipts).toHaveBeenCalledWith(900);
		expect(provider.getReceipts).toHaveBeenCalledWith(["ticket-1"]);
		expect(tokens.deactivateInvalidTokens).toHaveBeenCalledWith(["token-1"]);
	});
});
