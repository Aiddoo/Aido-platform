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
});
