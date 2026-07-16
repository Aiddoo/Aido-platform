import { asDep } from "@test/mocks";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { PrismaRetentionRepository } from "@/retention/infrastructure/persistence/prisma-retention.repository";
import { TestDatabase } from "../setup/test-database";

describe("신규 사용자 리텐션 V2 통합 테스트 (실제 DB)", () => {
	let testDb: TestDatabase;
	let prisma: PrismaClient;
	let activeClient: PrismaClient | Prisma.TransactionClient;
	let repository: PrismaRetentionRepository;

	beforeAll(async () => {
		testDb = new TestDatabase();
		prisma = await testDb.start();
		activeClient = prisma;
		repository = new PrismaRetentionRepository(
			asDep({
				get tx() {
					return activeClient;
				},
			}),
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
		const user = await prisma.user.create({
			data: {
				email,
				userTag: email.slice(0, 8).toUpperCase().padEnd(8, "X"),
				status: "ACTIVE",
				preference: {
					create: {
						pushEnabled: true,
						timezone: "Asia/Seoul",
						locale: "ko",
					},
				},
				consent: { create: { marketingPushAgreedAt: new Date() } },
			},
			select: { id: true },
		});
		return user.id;
	}

	it("기존 사용자는 migration 이후에도 assignment가 자동 생성되지 않는다", async () => {
		const userId = await createUser("legacy01@example.com");

		const count = await prisma.retentionExperimentAssignment.count({
			where: { userId },
		});

		expect(count).toBe(0);
	});

	it("신규 등록은 한 assignment와 네 단계만 멱등 생성한다", async () => {
		const userId = await createUser("newuser1@example.com");
		const startedAt = new Date("2026-07-15T00:00:00Z");

		await repository.enroll({ userId, variant: "TREATMENT", startedAt });
		await repository.enroll({ userId, variant: "CONTROL", startedAt });

		const assignments = await prisma.retentionExperimentAssignment.findMany({
			where: { userId },
			include: { stages: true },
		});
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
			prisma.userPreference.update({
				where: { userId: invalidTimezoneUserId },
				data: { timezone: "Invalid/Timezone" },
			}),
			prisma.userPreference.update({
				where: { userId: aliasTimezoneUserId },
				data: { timezone: "US/Eastern" },
			}),
		]);
		const [invalidCategory, aliasCategory] = await Promise.all([
			prisma.todoCategory.create({
				data: {
					userId: invalidTimezoneUserId,
					name: "업무",
					color: "#FF6B43",
				},
			}),
			prisma.todoCategory.create({
				data: {
					userId: aliasTimezoneUserId,
					name: "업무",
					color: "#FF6B43",
				},
			}),
		]);
		await Promise.all([
			prisma.todo.create({
				data: {
					userId: invalidTimezoneUserId,
					categoryId: invalidCategory.id,
					title: "잘못된 타임존에서도 조회되는 할 일",
					startDate: new Date("2026-07-16T00:00:00.000Z"),
				},
			}),
			prisma.todo.create({
				data: {
					userId: aliasTimezoneUserId,
					categoryId: aliasCategory.id,
					title: "레거시 별칭에서도 조회되는 할 일",
					startDate: new Date("2026-07-16T00:00:00.000Z"),
				},
			}),
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
				(candidate) =>
					candidate.timezone === "UTC" && candidate.todoCount === 1,
			),
		).toBe(true);
		expect(aliasTimezoneCandidates).toHaveLength(4);
		expect(
			aliasTimezoneCandidates.every(
				(candidate) =>
					candidate.timezone === "US/Eastern" && candidate.todoCount === 1,
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
		const stage = await prisma.retentionExperimentStage.findFirstOrThrow({
			where: { assignment: { userId }, stage: "D0" },
		});

		await expect(
			prisma.$transaction(async (tx) => {
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

		const [storedStage, notifications, dispatches, outboxes] =
			await Promise.all([
				prisma.retentionExperimentStage.findUniqueOrThrow({
					where: { id: stage.id },
				}),
				prisma.notification.count({ where: { userId } }),
				prisma.pushDispatch.count({ where: { userId } }),
				prisma.retentionPushOutbox.count(),
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
		const stages = await prisma.retentionExperimentStage.findMany({
			where: { assignment: { userId }, stage: { in: ["D0", "D1"] } },
			orderBy: { stage: "asc" },
		});
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
		const stored = await prisma.retentionPushOutbox.findMany({
			where: { id: { in: claimed.map((outbox) => outbox.id) } },
		});

		expect(claimed).toHaveLength(2);
		expect(new Set(claimed.map((outbox) => outbox.id)).size).toBe(2);
		expect(claimed.every((outbox) => outbox.attempts === 1)).toBe(true);
		expect(stored.every((outbox) => outbox.status === "PROCESSING")).toBe(true);
	});
});
