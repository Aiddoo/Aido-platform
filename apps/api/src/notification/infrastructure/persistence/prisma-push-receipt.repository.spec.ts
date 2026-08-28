import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TestBed } from "@suites/unit";
import { asMock, createMockPrisma, type MockPrismaClient } from "@test/mocks";

import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import { PrismaPushReceiptRepository } from "./prisma-push-receipt.repository";

describe("PrismaPushReceiptRepository", () => {
	let repository: PrismaPushReceiptRepository;
	let db: MockPrismaClient;

	beforeEach(async () => {
		db = createMockPrisma();
		const { unit } = await TestBed.solitary(PrismaPushReceiptRepository)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(TransactionHost)
			.impl(() => ({ tx: db }))
			.compile();
		repository = unit;
	});

	it("pending receipt를 오래된 순으로 제한 조회한다", async () => {
		asMock(db.pushDeliveryAttempt.findMany).mockResolvedValue([
			{ expoTicketId: "ticket-1", pushToken: { token: "token-1" } },
			{ expoTicketId: null, pushToken: { token: "token-2" } },
		]);

		await expect(repository.findPendingPushReceipts(900)).resolves.toEqual([
			{ ticketId: "ticket-1", token: "token-1" },
		]);
	});

	it("Expo receipt를 한 SQL로 기록하고 무효 토큰만 반환한다", async () => {
		asMock(db.$executeRaw).mockResolvedValue(2);
		asMock(db.pushDeliveryAttempt.findMany).mockResolvedValue([
			{ pushToken: { token: "ExponentPushToken[invalid]" } },
		]);

		await expect(
			repository.recordPushReceipts([
				{ ticketId: "ticket-success", delivered: true },
				{
					ticketId: "ticket-invalid",
					delivered: false,
					errorCode: "DeviceNotRegistered",
				},
			]),
		).resolves.toEqual(["ExponentPushToken[invalid]"]);
		expect(db.$executeRaw).toHaveBeenCalledTimes(1);
	});
});
