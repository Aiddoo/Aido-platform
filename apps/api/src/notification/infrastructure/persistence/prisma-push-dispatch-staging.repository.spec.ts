import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TestBed } from "@suites/unit";
import { asMock, createMockPrisma, type MockPrismaClient } from "@test/mocks";

import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import { PrismaPushDispatchStagingRepository } from "./prisma-push-dispatch-staging.repository";

describe("PrismaPushDispatchStagingRepository", () => {
	let repository: PrismaPushDispatchStagingRepository;
	let db: MockPrismaClient;

	beforeEach(async () => {
		db = createMockPrisma();
		const { unit } = await TestBed.solitary(PrismaPushDispatchStagingRepository)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(TransactionHost)
			.impl(() => ({ tx: db }))
			.compile();
		repository = unit;
	});

	it("빈 배치는 dispatch와 outbox를 쓰지 않는다", async () => {
		await expect(repository.stageMany([])).resolves.toEqual([]);
		expect(db.$queryRaw).not.toHaveBeenCalled();
		expect(db.$executeRaw).not.toHaveBeenCalled();
	});

	it("dispatch insert 결과를 같은 호출에서 전용 outbox로 staging한다", async () => {
		asMock(db.$queryRaw).mockResolvedValue([{ dispatchId: 51, notificationId: 21 }]);
		asMock(db.$executeRaw).mockResolvedValue(1);

		await expect(
			repository.stage({
				notificationId: 21,
				userId: "user-1",
				purpose: "TRANSACTIONAL",
				deliveryMode: "SINGLE",
				force: true,
			}),
		).resolves.toEqual({ dispatchId: 51, notificationId: 21 });
		expect(db.$queryRaw).toHaveBeenCalledTimes(1);
		expect(db.$executeRaw).toHaveBeenCalledTimes(1);
	});

	it("DB가 partial 결과를 반환하면 outbox insert 전에 명시적으로 실패한다", async () => {
		asMock(db.$queryRaw).mockResolvedValue([{ dispatchId: 51, notificationId: 21 }]);

		await expect(
			repository.stageMany([
				{
					notificationId: 21,
					userId: "user-1",
					purpose: "TRANSACTIONAL",
					deliveryMode: "BATCH",
					force: false,
				},
				{
					notificationId: 22,
					userId: "user-2",
					purpose: "TRANSACTIONAL",
					deliveryMode: "BATCH",
					force: false,
				},
			]),
		).rejects.toThrow("Push dispatch staging returned partial rows");
		expect(db.$executeRaw).not.toHaveBeenCalled();
	});
});
