import { TestDatabase } from "@test/setup/test-database";

import type { PrismaClient } from "@/generated/prisma/client";
import { PostgresPushRateLimiter } from "@/notification/infrastructure/rate-limiter/postgres-push-rate-limiter";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

describe("PostgresPushRateLimiter (실제 PostgreSQL)", () => {
	let testDatabase: TestDatabase;
	let prisma: PrismaClient;
	let limiter: PostgresPushRateLimiter;

	beforeAll(async () => {
		testDatabase = new TestDatabase();
		prisma = await testDatabase.start();
		limiter = new PostgresPushRateLimiter(prisma as unknown as DatabaseService);
	});

	afterAll(async () => testDatabase?.stop());
	beforeEach(async () => testDatabase.cleanup());

	async function createUser(suffix: string): Promise<string> {
		const user = await prisma.user.create({
			data: {
				email: `rate-limit-${suffix}@example.com`,
				userTag: suffix.padEnd(8, "X").slice(0, 8),
				status: "ACTIVE",
			},
			select: { id: true },
		});
		return user.id;
	}

	async function createDispatch(userId: string, suffix: string): Promise<number> {
		const notification = await prisma.notification.create({
			data: { userId, type: "SYSTEM_NOTICE", title: suffix, body: suffix },
			select: { id: true },
		});
		const dispatch = await prisma.pushDispatch.create({
			data: {
				notificationId: notification.id,
				userId,
				purpose: "ENGAGEMENT",
			},
			select: { id: true },
		});
		return dispatch.id;
	}

	it("재시작 후 같은 dispatch를 재시도해도 quota를 한 번만 예약한다", async () => {
		const userId = await createUser("retry");
		const dispatchId = await createDispatch(userId, "retry");

		await expect(limiter.reserveGeneral({ dispatchId, userId })).resolves.toBe(false);
		const restarted = new PostgresPushRateLimiter(prisma as unknown as DatabaseService);
		await expect(restarted.reserveGeneral({ dispatchId, userId })).resolves.toBe(false);

		await expect(
			prisma.pushRateLimitReservation.count({ where: { dispatchId, phase: "GENERAL" } }),
		).resolves.toBe(1);
	});

	it("동일 사용자의 경계 동시 요청을 Serializable 재시도로 정확히 한 건만 허용한다", async () => {
		const userId = await createUser("race");
		const dispatchIds = await Promise.all(
			Array.from({ length: 16 }, (_, index) => createDispatch(userId, `race-${index}`)),
		);
		for (const dispatchId of dispatchIds.slice(0, 14)) {
			await expect(limiter.reserveGeneral({ dispatchId, userId })).resolves.toBe(false);
		}

		const decisions = await Promise.all(
			dispatchIds.slice(14).map((dispatchId) => limiter.reserveGeneral({ dispatchId, userId })),
		);
		expect(decisions.toSorted()).toEqual([false, true]);
		await expect(
			prisma.pushRateLimitReservation.count({ where: { userId, phase: "GENERAL" } }),
		).resolves.toBe(15);
	});

	it("배치 예약은 서로 다른 사용자를 한 트랜잭션에서 일반·engagement로 저장한다", async () => {
		const firstUserId = await createUser("batch-a");
		const secondUserId = await createUser("batch-b");
		const firstDispatchId = await createDispatch(firstUserId, "batch-a");
		const secondDispatchId = await createDispatch(secondUserId, "batch-b");

		await expect(
			limiter.reserveBatch([
				{
					dispatchId: firstDispatchId,
					userId: firstUserId,
					engagementLocalDate: "2026-08-29",
				},
				{ dispatchId: secondDispatchId, userId: secondUserId },
			]),
		).resolves.toEqual([false, false]);
		await expect(prisma.pushRateLimitReservation.count()).resolves.toBe(3);
	});
});
