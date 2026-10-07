import { and } from "@prisma/orm-postgres/orm-client";

import { PostgresPushRateLimiter } from "#api/notification/infrastructure/rate-limiter/postgres-push-rate-limiter";
import { decodeRecord, encodeCreate } from "#api/shared/infrastructure/database/database-records";
import { createTestDatabaseService } from "#test/setup/database-context";
import type { TestDatabaseClient } from "#test/setup/test-database";
import { TestDatabase } from "#test/setup/test-database";

describe("PostgresPushRateLimiter (실제 PostgreSQL)", () => {
	let testDatabase: TestDatabase;
	let prisma: TestDatabaseClient;
	let limiter: PostgresPushRateLimiter;

	beforeAll(async () => {
		testDatabase = new TestDatabase();
		prisma = await testDatabase.start();
		limiter = new PostgresPushRateLimiter(createTestDatabaseService(prisma));
	});

	afterAll(async () => testDatabase?.stop());
	beforeEach(async () => testDatabase.cleanup());

	async function createUser(suffix: string): Promise<string> {
		const user = decodeRecord(
			"User",
			await prisma.orm.public.User.select("id").create(
				encodeCreate("User", {
					email: `rate-limit-${suffix}@example.com`,
					userTag: suffix.padEnd(8, "X").slice(0, 8),
					status: "ACTIVE",
				}),
			),
		);
		return user.id;
	}

	async function createDispatch(userId: string, suffix: string): Promise<number> {
		const notification = decodeRecord(
			"Notification",
			await prisma.orm.public.Notification.select("id").create(
				encodeCreate("Notification", {
					userId,
					type: "SYSTEM_NOTICE",
					title: suffix,
					body: suffix,
				}),
			),
		);
		const dispatch = decodeRecord(
			"PushDispatch",
			await prisma.orm.public.PushDispatch.select("id").create(
				encodeCreate("PushDispatch", {
					notificationId: notification.id,
					userId,
					purpose: "ENGAGEMENT",
				}),
			),
		);
		return dispatch.id;
	}

	it("재시작 후 같은 dispatch를 재시도해도 quota를 한 번만 예약한다", async () => {
		const userId = await createUser("retry");
		const dispatchId = await createDispatch(userId, "retry");

		await expect(limiter.reserveGeneral({ dispatchId, userId })).resolves.toBe(false);
		const restarted = new PostgresPushRateLimiter(createTestDatabaseService(prisma));
		await expect(restarted.reserveGeneral({ dispatchId, userId })).resolves.toBe(false);

		await expect(
			prisma.orm.public.PushRateLimitReservation.where((row) =>
				and(row.dispatchId.eq(dispatchId), row.phase.eq("GENERAL")),
			)
				.aggregate((aggregate) => ({ count: aggregate.count() }))
				.then(({ count }) => count),
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
			prisma.orm.public.PushRateLimitReservation.where((row) =>
				and(row.userId.eq(userId), row.phase.eq("GENERAL")),
			)
				.aggregate((aggregate) => ({ count: aggregate.count() }))
				.then(({ count }) => count),
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
		await expect(
			prisma.orm.public.PushRateLimitReservation.aggregate((aggregate) => ({
				count: aggregate.count(),
			})).then(({ count }) => count),
		).resolves.toBe(3);
	});
});
