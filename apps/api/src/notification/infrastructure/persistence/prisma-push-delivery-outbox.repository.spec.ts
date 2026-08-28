import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TestBed } from "@suites/unit";
import { asMock, createMockPrisma, type MockPrismaClient } from "@test/mocks";

import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import { PrismaPushDeliveryOutboxRepository } from "./prisma-push-delivery-outbox.repository";

describe("PrismaPushDeliveryOutboxRepository", () => {
	let repository: PrismaPushDeliveryOutboxRepository;
	let db: MockPrismaClient;

	beforeEach(async () => {
		db = createMockPrisma();
		const { unit } = await TestBed.solitary(PrismaPushDeliveryOutboxRepository)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(TransactionHost)
			.impl(() => ({ tx: db }))
			.compile();
		repository = unit;
	});

	it("빈 targeted claim은 DB를 호출하지 않는다", async () => {
		await expect(repository.claimByDispatchIds([], new Date())).resolves.toEqual([]);
		expect(db.$queryRaw).not.toHaveBeenCalled();
	});

	it("claim 결과의 증가한 generation을 그대로 반환한다", async () => {
		asMock(db.$queryRaw).mockResolvedValue([{ dispatchId: 7, publishAttempt: 4 }]);

		await expect(repository.claimAvailable({ limit: 100, lockedAt: new Date() })).resolves.toEqual([
			{ dispatchId: 7, publishAttempt: 4 },
		]);
		expect(db.$queryRaw).toHaveBeenCalledTimes(1);
	});

	it("mark와 defer는 정렬된 generation lock 뒤 guarded update를 사용한다", async () => {
		asMock(db.$executeRaw).mockResolvedValue(1);
		const publications = [{ dispatchId: 9, publishAttempt: 2 }] as const;

		await expect(repository.markPublished(publications, new Date())).resolves.toBe(1);
		await expect(
			repository.defer({ publications, availableAt: new Date(), error: "queue unavailable" }),
		).resolves.toBe(1);
		expect(db.$queryRaw).toHaveBeenCalledTimes(2);
		expect(db.$executeRaw).toHaveBeenCalledTimes(2);
	});
});
