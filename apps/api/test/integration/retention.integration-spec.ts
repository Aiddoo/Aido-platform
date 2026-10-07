import { AsyncLocalStorage } from "node:async_hooks";

import type { TransactionHost } from "@nestjs-cls/transactional";
import { and } from "@prisma/orm-postgres/orm-client";

import { PrismaRetentionRepository } from "#api/retention/infrastructure/persistence/prisma-retention.repository";
import {
	decodeRecord,
	encodeCreate,
	encodePatch,
} from "#api/shared/infrastructure/database/database-records";
import { createEntityId } from "#api/shared/infrastructure/database/database-values";
import { requireRecord } from "#api/shared/infrastructure/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";
import type { Prisma8Transaction } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";
import { asDep } from "#test/mocks/index";
import { createDatabaseContext, withDatabaseTransaction } from "#test/setup/database-context";
import type { TestDatabaseClient } from "#test/setup/test-database";
import { createUserDatabaseFixture } from "#test/setup/user-database-fixture";

import { TestDatabase } from "../setup/test-database.js";

describe("신규 사용자 리텐션 V2 통합 테스트 (실제 DB)", () => {
	let testDb: TestDatabase;
	let prisma: TestDatabaseClient;
	let activeClient: TestDatabaseClient | Prisma8Transaction;
	let repository: PrismaRetentionRepository;
	const transactionContext = new AsyncLocalStorage<Prisma8Transaction>();

	beforeAll(async () => {
		testDb = new TestDatabase();
		prisma = await testDb.start();
		activeClient = prisma;
		repository = new PrismaRetentionRepository(
			asDep<TransactionHost<Prisma8TransactionalAdapter>>({
				get tx() {
					return (
						transactionContext.getStore() ??
						("runtime" in activeClient ? createDatabaseContext(activeClient) : activeClient)
					);
				},
			}),
			{
				async run(work) {
					if (transactionContext.getStore() !== undefined || !("runtime" in activeClient))
						return work();
					return withDatabaseTransaction(prisma, (tx) => transactionContext.run(tx, work));
				},
			},
		);
	}, 60_000);

	beforeEach(async () => {
		activeClient = prisma;
		await testDb.cleanup();
	});

	afterAll(async () => {
		await testDb.stop();
	});

	async function createUser(email: string): Promise<string> {
		const user = decodeRecord(
			"User",
			await createUserDatabaseFixture(
				prisma,
				encodeCreate("User", {
					email,
					userTag: email.slice(0, 8).toUpperCase().padEnd(8, "X"),
					status: "ACTIVE",
				}),
				{
					preference: encodePatch("UserPreference", {
						id: createEntityId(),
						pushEnabled: true,
						timezone: "Asia/Seoul",
						locale: "ko",
					}),
					consent: encodePatch("UserConsent", {
						id: createEntityId(),
						marketingPushAgreedAt: new Date(),
					}),
				},
			),
		);
		return user.id;
	}

	it("기존 사용자는 migration 이후에도 assignment가 자동 생성되지 않는다", async () => {
		const userId = await createUser("legacy01@example.com");

		const count = (
			await prisma.orm.public.RetentionExperimentAssignment.where((row) =>
				row.userId.eq(userId),
			).aggregate((aggregate) => ({ count: aggregate.count() }))
		).count;

		expect(count).toBe(0);
	});

	it("신규 등록은 한 assignment와 네 단계만 멱등 생성한다", async () => {
		const userId = await createUser("newuser1@example.com");
		const startedAt = new Date("2026-07-15T00:00:00Z");

		await repository.enroll({ userId, variant: "TREATMENT", startedAt });
		await repository.enroll({ userId, variant: "CONTROL", startedAt });

		const assignments = decodeRecord(
			"RetentionExperimentAssignment",
			await prisma.orm.public.RetentionExperimentAssignment.where((row) => row.userId.eq(userId))
				.include("stages")
				.all(),
		);
		expect(assignments).toHaveLength(1);
		expect(assignments[0]?.variant).toBe("TREATMENT");
		expect(assignments[0]?.stages).toHaveLength(4);
	});

	it("stage 후보를 N+1 없이 집계 projection으로 조회한다", async () => {
		const userId = await createUser("projection@example.com");
		await repository.enroll({
			userId,
			variant: "TREATMENT",
			startedAt: new Date("2026-07-15T00:00:00Z"),
		});

		const candidates = await repository.findScheduledStages(200);

		expect(candidates).toHaveLength(4);
		expect(
			candidates.every(
				(candidate) =>
					candidate.todoCount === 0 &&
					candidate.completedCount === 0 &&
					candidate.incompleteCount === 0 &&
					candidate.activeTokenCount === 0 &&
					!candidate.todoActionWithinWindow,
			),
		).toBe(true);
	});

	it("저장된 타임존이 잘못되어도 UTC로 조회하고 유효한 별칭은 보존한다", async () => {
		const invalidTimezoneUserId = await createUser("invalidtz@example.com");
		const aliasTimezoneUserId = await createUser("aliastz1@example.com");
		await Promise.all([
			prisma.orm.public.UserPreference.where((row) => row.userId.eq(invalidTimezoneUserId))
				.update(encodePatch("UserPreference", { timezone: "Invalid/Timezone" }))
				.then((row) => decodeRecord("UserPreference", requireRecord(row))),
			prisma.orm.public.UserPreference.where((row) => row.userId.eq(aliasTimezoneUserId))
				.update(encodePatch("UserPreference", { timezone: "US/Eastern" }))
				.then((row) => decodeRecord("UserPreference", requireRecord(row))),
		]);
		const [invalidCategory, aliasCategory] = await Promise.all([
			prisma.orm.public.TodoCategory.create(
				encodeCreate("TodoCategory", {
					userId: invalidTimezoneUserId,
					name: "업무",
					color: "#FF6B43",
				}),
			).then((row) => decodeRecord("TodoCategory", row)),
			prisma.orm.public.TodoCategory.create(
				encodeCreate("TodoCategory", {
					userId: aliasTimezoneUserId,
					name: "업무",
					color: "#FF6B43",
				}),
			).then((row) => decodeRecord("TodoCategory", row)),
		]);
		await Promise.all([
			prisma.orm.public.Todo.create(
				encodeCreate("Todo", {
					userId: invalidTimezoneUserId,
					categoryId: invalidCategory.id,
					title: "잘못된 타임존에서도 조회되는 할 일",
					startDate: new Date("2026-07-16T00:00:00.000Z"),
				}),
			).then((row) => decodeRecord("Todo", row)),
			prisma.orm.public.Todo.create(
				encodeCreate("Todo", {
					userId: aliasTimezoneUserId,
					categoryId: aliasCategory.id,
					title: "레거시 별칭에서도 조회되는 할 일",
					startDate: new Date("2026-07-16T00:00:00.000Z"),
				}),
			).then((row) => decodeRecord("Todo", row)),
		]);
		const startedAt = new Date("2026-07-15T00:00:00.000Z");
		await Promise.all([
			repository.enroll({
				userId: invalidTimezoneUserId,
				variant: "TREATMENT",
				startedAt,
			}),
			repository.enroll({
				userId: aliasTimezoneUserId,
				variant: "TREATMENT",
				startedAt,
			}),
		]);

		const candidates = await repository.findScheduledStages(200);
		const invalidTimezoneCandidates = candidates.filter(
			(candidate) => candidate.userId === invalidTimezoneUserId,
		);
		const aliasTimezoneCandidates = candidates.filter(
			(candidate) => candidate.userId === aliasTimezoneUserId,
		);

		expect(invalidTimezoneCandidates).toHaveLength(4);
		expect(
			invalidTimezoneCandidates.every(
				(candidate) => candidate.timezone === "UTC" && candidate.todoCount === 1,
			),
		).toBe(true);
		expect(aliasTimezoneCandidates).toHaveLength(4);
		expect(
			aliasTimezoneCandidates.every(
				(candidate) => candidate.timezone === "US/Eastern" && candidate.todoCount === 1,
			),
		).toBe(true);
	});

	it("Notification·Dispatch·Outbox 생성 실패 시 단계 상태까지 전부 rollback한다", async () => {
		const userId = await createUser("rollback@example.com");
		await repository.enroll({
			userId,
			variant: "TREATMENT",
			startedAt: new Date(),
		});
		const stage = decodeRecord(
			"RetentionExperimentStage",
			requireRecord(
				await prisma.orm.public.RetentionExperimentStage.where((row) =>
					and(
						row.assignment.some((related) => related.userId.eq(userId)),
						row.stage.eq("D0"),
					),
				).first(),
			),
		);

		await expect(
			withDatabaseTransaction(prisma, async (tx) => {
				activeClient = tx;
				await repository.createDelivery({
					stageId: stage.id,
					userId,
					timezone: "Asia/Seoul",
					title: "title",
					body: "body",
					route: "/feed",
					variantId: "d0_no_todo",
				});
				throw new Error("force rollback");
			}),
		).rejects.toThrow("force rollback");
		activeClient = prisma;

		const [storedStage, notifications, dispatches, outboxes] = await Promise.all([
			prisma.orm.public.RetentionExperimentStage.where((row) => row.id.eq(stage.id))
				.first()
				.then((row) => decodeRecord("RetentionExperimentStage", requireRecord(row))),
			prisma.orm.public.Notification.where((row) => row.userId.eq(userId))
				.aggregate((aggregate) => ({ count: aggregate.count() }))
				.then(({ count }) => count),
			prisma.orm.public.PushDispatch.where((row) => row.userId.eq(userId))
				.aggregate((aggregate) => ({ count: aggregate.count() }))
				.then(({ count }) => count),
			prisma.orm.public.RetentionPushOutbox.aggregate((aggregate) => ({
				count: aggregate.count(),
			})).then(({ count }) => count),
		]);
		expect(storedStage.status).toBe("SCHEDULED");
		expect([notifications, dispatches, outboxes]).toEqual([0, 0, 0]);
	});

	it("동시 relay가 SKIP LOCKED로 서로 다른 outbox를 한 번씩 claim한다", async () => {
		const userId = await createUser("claimbox@example.com");
		await repository.enroll({
			userId,
			variant: "TREATMENT",
			startedAt: new Date(),
		});
		const stages = decodeRecord(
			"RetentionExperimentStage",
			await prisma.orm.public.RetentionExperimentStage.where((row) =>
				and(
					row.assignment.some((related) => related.userId.eq(userId)),
					row.stage.in(["D0", "D1"]),
				),
			)
				.orderBy((row) => row.stage.asc())
				.all(),
		);
		for (const stage of stages) {
			await repository.createDelivery({
				stageId: stage.id,
				userId,
				timezone: "Asia/Seoul",
				title: `title-${stage.stage}`,
				body: "body",
				route: "/feed",
				variantId: `variant-${stage.stage}`,
			});
		}

		const now = new Date();
		const batches = await Promise.all([
			repository.claimOutboxes(1, now),
			repository.claimOutboxes(1, now),
		]);
		const claimed = batches.flat();
		const stored = decodeRecord(
			"RetentionPushOutbox",
			await prisma.orm.public.RetentionPushOutbox.where((row) =>
				row.id.in(claimed.map((outbox) => outbox.id)),
			).all(),
		);

		expect(claimed).toHaveLength(2);
		expect(new Set(claimed.map((outbox) => outbox.id)).size).toBe(2);
		expect(claimed.every((outbox) => outbox.attempts === 1)).toBe(true);
		expect(stored.every((outbox) => outbox.status === "PROCESSING")).toBe(true);
	});
});
