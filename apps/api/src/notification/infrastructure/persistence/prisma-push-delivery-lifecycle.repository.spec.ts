import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TestBed } from "@suites/unit";
import { asMock, createMockPrisma, type MockPrismaClient } from "@test/mocks";

import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type {
	FinalizePushDeliveryResultsInput,
	PushDeliveryFence,
} from "../../application/ports/push-delivery-lifecycle.repository.port";
import { PrismaPushDeliveryLifecycleRepository } from "./prisma-push-delivery-lifecycle.repository";

interface SqlFragment {
	readonly values: readonly unknown[];
}

function fence(dispatchId: number, deliveryAttemptCount = 1): PushDeliveryFence {
	return {
		dispatchId,
		publishAttempt: 1,
		processingJobId: "job-1",
		deliveryAttemptCount,
	};
}

function resultInput(
	dispatchId: number,
	results: FinalizePushDeliveryResultsInput["results"],
): FinalizePushDeliveryResultsInput {
	return {
		fence: fence(dispatchId),
		context: { timezone: "Asia/Seoul", localDate: new Date("2026-08-29T00:00:00Z") },
		results,
	};
}

describe("PrismaPushDeliveryLifecycleRepository", () => {
	let repository: PrismaPushDeliveryLifecycleRepository;
	let db: MockPrismaClient;

	beforeEach(async () => {
		db = createMockPrisma();
		const { unit } = await TestBed.solitary(PrismaPushDeliveryLifecycleRepository)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(TransactionHost)
			.impl(() => ({ tx: db }))
			.compile();
		repository = unit;
	});

	it("claim hydration도 dispatch ID와 증가한 delivery attempt를 함께 fencing한다", async () => {
		asMock(db.$queryRaw).mockResolvedValue([
			{ dispatchId: 41, deliveryAttemptCount: 3, publishAttempt: 2, ownedOutboxCount: 1 },
		]);
		asMock(db.pushDispatch.findMany).mockResolvedValue([]);

		await expect(
			repository.claim({
				publications: [{ dispatchId: 41, publishAttempt: 2 }],
				processingJobId: "job-claim",
				processingJobAttempt: 1,
				startedAt: new Date("2026-08-29T05:00:00Z"),
			}),
		).rejects.toThrow("Push delivery claim hydration fence mismatch");

		expect(db.pushDispatch.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					OR: [{ id: 41, deliveryAttemptCount: 3 }],
					processingJobId: "job-claim",
					status: "PROCESSING",
				},
			}),
		);
	});

	it("두 token 결과를 정확히 두 attempt row로 bulk upsert한다", async () => {
		asMock(db.pushToken.findMany).mockResolvedValue([
			{ id: 801, token: "token-a" },
			{ id: 802, token: "token-b" },
		]);
		asMock(db.$queryRaw).mockResolvedValue([{ dispatchId: 701, publishAttempt: 1 }]);
		asMock(db.$executeRaw).mockResolvedValue(1);

		await repository.finalizeResults([
			resultInput(701, [
				{ token: "token-a", success: true, ticketId: "ticket-a" },
				{ token: "token-b", success: false, error: "rejected" },
			]),
		]);

		expect(db.$executeRaw).toHaveBeenCalledTimes(2);
		const attemptStatement = asMock(db.$executeRaw).mock.calls[0]?.[0] as unknown as SqlFragment;
		expect(attemptStatement.values.filter((value) => value === 701)).toHaveLength(2);
		expect(attemptStatement.values.filter((value) => value === 801)).toHaveLength(1);
		expect(attemptStatement.values.filter((value) => value === 802)).toHaveLength(1);
	});

	it("100 dispatch 결과도 고정된 네 번의 DB 호출로 finalize한다", async () => {
		const inputs = Array.from({ length: 100 }, (_, index) =>
			resultInput(index + 1, [
				{ token: `token-${index + 1}`, success: true, ticketId: `ticket-${index + 1}` },
			]),
		);
		asMock(db.pushToken.findMany).mockResolvedValue(
			inputs.map((_, index) => ({ id: index + 101, token: `token-${index + 1}` })),
		);
		asMock(db.$queryRaw).mockResolvedValue(
			inputs.map((input) => ({
				dispatchId: input.fence.dispatchId,
				publishAttempt: input.fence.publishAttempt,
			})),
		);
		asMock(db.$executeRaw).mockResolvedValue(100);

		await expect(repository.finalizeResults(inputs)).resolves.toBe(100);

		expect(db.pushToken.findMany).toHaveBeenCalledTimes(1);
		expect(db.$queryRaw).toHaveBeenCalledTimes(1);
		expect(db.$executeRaw).toHaveBeenCalledTimes(2);
	});

	it("100 중간-attempt lease release도 한 번의 set-based update로 처리한다", async () => {
		asMock(db.$queryRaw).mockResolvedValue(
			Array.from({ length: 100 }, (_, index) => ({
				dispatchId: index + 1,
				publishAttempt: 1,
				reopenOutbox: false,
				availableAt: new Date("2026-08-29T00:00:00Z"),
				lastError: "provider unavailable",
			})),
		);

		await expect(
			repository.release(
				Array.from({ length: 100 }, (_, index) => ({
					fence: fence(index + 1),
					error: "provider unavailable",
					reopenOutbox: false,
					availableAt: new Date("2026-08-29T00:00:00Z"),
				})),
			),
		).resolves.toBe(100);
		expect(db.$queryRaw).toHaveBeenCalledTimes(1);
		expect(db.$executeRaw).not.toHaveBeenCalled();
	});

	it("마지막 runtime attempt release는 같은 generation outbox를 한 번에 reopen한다", async () => {
		const availableAt = new Date("2026-08-29T00:00:01Z");
		asMock(db.$queryRaw).mockResolvedValue([
			{
				dispatchId: 7,
				publishAttempt: 1,
				reopenOutbox: true,
				availableAt,
				lastError: "transport unavailable",
			},
		]);
		asMock(db.$executeRaw).mockResolvedValue(1);

		await expect(
			repository.release([
				{
					fence: fence(7),
					error: "transport unavailable",
					reopenOutbox: true,
					availableAt,
				},
			]),
		).resolves.toBe(1);

		expect(db.$queryRaw).toHaveBeenCalledTimes(1);
		expect(db.$executeRaw).toHaveBeenCalledTimes(1);
	});

	it("마지막 attempt의 outbox fence가 맞지 않으면 transaction rollback을 위해 실패한다", async () => {
		const availableAt = new Date("2026-08-29T00:00:01Z");
		asMock(db.$queryRaw).mockResolvedValue([
			{
				dispatchId: 7,
				publishAttempt: 1,
				reopenOutbox: true,
				availableAt,
				lastError: "transport unavailable",
			},
		]);
		asMock(db.$executeRaw).mockResolvedValue(0);

		await expect(
			repository.release([
				{
					fence: fence(7),
					error: "transport unavailable",
					reopenOutbox: true,
					availableAt,
				},
			]),
		).rejects.toThrow("Push delivery outbox reopen fence mismatch");
	});
});
