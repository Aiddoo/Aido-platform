import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { PrismaAdminGrowthMetricsAdapter } from "@/admin/infrastructure/adapters/prisma-admin-growth-metrics.adapter";
import { UserRepository } from "@/auth/infrastructure/persistence/user.repository";
import type { PrismaClient } from "@/generated/prisma/client";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { TestDatabase } from "../setup/test-database";

describe("성장 지표 통합 테스트 (실제 DB)", () => {
	let testDb: TestDatabase;
	let prisma: PrismaClient;
	let activityWriter: UserRepository;
	let growthMetrics: PrismaAdminGrowthMetricsAdapter;

	beforeAll(async () => {
		testDb = new TestDatabase();
		prisma = await testDb.start();
		const txHost = {
			tx: prisma,
		} as unknown as TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>;
		activityWriter = new UserRepository(txHost);
		growthMetrics = new PrismaAdminGrowthMetricsAdapter(
			prisma as DatabaseService,
		);
	}, 60_000);

	beforeEach(async () => {
		await testDb.cleanup();
	});

	afterAll(async () => {
		await testDb.stop();
	});

	it("현지 날짜 upsert가 firstSeenAt을 보존하고 병렬 writer에도 한 행만 남긴다", async () => {
		// Given - 실제 PostgreSQL 사용자와 서울 타임존
		await prisma.user.create({
			data: {
				id: "activity-user",
				email: "activity@example.com",
				userTag: "ACT00001",
				status: "ACTIVE",
			},
		});

		// When - 첫 기록 후 기존 firstSeenAt을 과거로 고정하고 병렬로 재기록하면
		await activityWriter.updateLastActiveAt("activity-user", "Asia/Seoul");
		const first = await prisma.userActivityDay.findUniqueOrThrow({
			where: {
				userId_localDate: {
					userId: "activity-user",
					localDate: (
						await prisma.userActivityDay.findFirstOrThrow({
							where: { userId: "activity-user" },
							select: { localDate: true },
						})
					).localDate,
				},
			},
		});
		const preservedFirstSeenAt = new Date("2025-01-01T00:00:00.000Z");
		await prisma.userActivityDay.update({
			where: { id: first.id },
			data: {
				firstSeenAt: preservedFirstSeenAt,
				lastSeenAt: preservedFirstSeenAt,
			},
		});
		await Promise.all(
			Array.from({ length: 6 }, () =>
				activityWriter.updateLastActiveAt("activity-user", "Asia/Seoul"),
			),
		);

		// Then - 사용자 현지 날짜와 원자적 최종 시각이 보존된다
		const rows = await prisma.userActivityDay.findMany({
			where: { userId: "activity-user" },
		});
		const user = await prisma.user.findUniqueOrThrow({
			where: { id: "activity-user" },
		});
		expect(rows).toHaveLength(1);
		const row = rows[0];
		expect(row).toBeDefined();
		if (!row) return;
		const expectedLocalDate = new Intl.DateTimeFormat("en-CA", {
			timeZone: "Asia/Seoul",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).format(row.lastSeenAt);
		expect(row.localDate.toISOString().slice(0, 10)).toBe(expectedLocalDate);
		expect(row.firstSeenAt).toEqual(preservedFirstSeenAt);
		expect(row.lastSeenAt.getTime()).toBeGreaterThan(
			preservedFirstSeenAt.getTime(),
		);
		expect(user.lastActiveAt).toEqual(row.lastSeenAt);
	});

	it("늦게 커밋된 과거 활동이 최신 사용자·활동 시각을 되돌리지 않는다", async () => {
		// Given - 서로 다른 인스턴스가 같은 사용자 활동을 기록한다
		await prisma.user.create({
			data: {
				id: "out-of-order-user",
				email: "out-of-order@example.com",
				userTag: "ACT00002",
				status: "ACTIVE",
			},
		});
		const otherWriter = createActivityWriter(prisma);
		const earlier = new Date("2026-07-26T15:10:00.000Z");
		const later = new Date("2026-07-26T15:30:00.000Z");
		jest.useFakeTimers({
			doNotFake: ["nextTick", "setImmediate", "setInterval", "setTimeout"],
		});

		try {
			// When - 최신 활동이 먼저 커밋되고 과거 시각의 writer가 나중에 커밋되면
			jest.setSystemTime(later);
			await activityWriter.updateLastActiveAt(
				"out-of-order-user",
				"Asia/Seoul",
			);
			jest.setSystemTime(earlier);
			await otherWriter.updateLastActiveAt("out-of-order-user", "Asia/Seoul");
		} finally {
			jest.useRealTimers();
		}

		// Then - first는 최솟값, last와 사용자 활동은 최댓값을 유지한다
		const row = await prisma.userActivityDay.findFirstOrThrow({
			where: { userId: "out-of-order-user" },
		});
		const user = await prisma.user.findUniqueOrThrow({
			where: { id: "out-of-order-user" },
		});
		expect(row.firstSeenAt).toEqual(earlier);
		expect(row.lastSeenAt).toEqual(later);
		expect(user.lastActiveAt).toEqual(later);
	});

	it("병렬 최초 insert 충돌에서도 첫·마지막 활동 시각의 극값을 남긴다", async () => {
		// Given - 아직 활동 행이 없는 사용자와 독립 writer 두 개
		await prisma.user.create({
			data: {
				id: "parallel-insert-user",
				email: "parallel-insert@example.com",
				userTag: "ACT00003",
				status: "ACTIVE",
			},
		});
		const otherWriter = createActivityWriter(prisma);
		const earlier = new Date("2026-07-26T16:10:00.000Z");
		const later = new Date("2026-07-26T16:30:00.000Z");
		jest.useFakeTimers({
			doNotFake: ["nextTick", "setImmediate", "setInterval", "setTimeout"],
		});

		try {
			// When - 같은 현지 날짜의 서로 다른 시각을 병렬 기록하면
			jest.setSystemTime(earlier);
			const earlierWrite = activityWriter.updateLastActiveAt(
				"parallel-insert-user",
				"Asia/Seoul",
			);
			jest.setSystemTime(later);
			const laterWrite = otherWriter.updateLastActiveAt(
				"parallel-insert-user",
				"Asia/Seoul",
			);
			await Promise.all([earlierWrite, laterWrite]);
		} finally {
			jest.useRealTimers();
		}

		// Then - unique 충돌 순서와 무관하게 양 끝 시각이 보존된다
		const row = await prisma.userActivityDay.findFirstOrThrow({
			where: { userId: "parallel-insert-user" },
		});
		const user = await prisma.user.findUniqueOrThrow({
			where: { id: "parallel-insert-user" },
		});
		expect(row.firstSeenAt).toEqual(earlier);
		expect(row.lastSeenAt).toEqual(later);
		expect(user.lastActiveAt).toEqual(later);
	});

	it("가입 현지 날짜, 측정 시작, 성숙 cohort, DAU/WAU/MAU를 집계한다", async () => {
		// Given - 타임존 경계·측정 전·미성숙 cohort를 포함한 실제 데이터
		await seedGrowthScenario(prisma);

		// When - 2026-07-30을 끝 날짜로 성장 요약을 집계하면
		const result = await growthMetrics.getSummary({
			cohortFrom: "2026-06-01",
			cohortTo: "2026-07-30",
			asOf: new Date("2026-07-31T12:00:00.000Z"),
		});

		// Then - 식별자 없이 cohort 산술과 trailing active windows를 반환한다
		expect(result).toEqual({
			measurementStartedAt: new Date("2026-06-01T00:00:00.000Z"),
			totalActiveUsers: 4,
			signups: 4,
			dau: 0,
			wau: 1,
			mau: 2,
			activationEligible: 4,
			activationAchieved: 2,
			d1Eligible: 3,
			d1Achieved: 3,
			d7Eligible: 3,
			d7Achieved: 2,
			d30Eligible: 2,
			d30Achieved: 1,
			d7RetainedActivatedUsers: 2,
		});
	});

	it("삭제된 사용자는 성장·활성·리텐션의 어떤 집계에도 포함하지 않는다", async () => {
		// Given - 기존 시나리오에 모든 지표를 달성한 soft-delete 사용자를 추가하고
		await seedGrowthScenario(prisma);
		await seedDeletedGrowthUser(prisma);

		// When - 같은 cohort를 집계하면
		const result = await growthMetrics.getSummary({
			cohortFrom: "2026-06-01",
			cohortTo: "2026-07-30",
			asOf: new Date("2026-07-31T12:00:00.000Z"),
		});

		// Then - 삭제 사용자는 모든 count에서 빠지고 instrumentation 시작은 유지된다
		expect(result).toEqual({
			measurementStartedAt: new Date("2026-06-01T00:00:00.000Z"),
			totalActiveUsers: 4,
			signups: 4,
			dau: 0,
			wau: 1,
			mau: 2,
			activationEligible: 4,
			activationAchieved: 2,
			d1Eligible: 3,
			d1Achieved: 3,
			d7Eligible: 3,
			d7Achieved: 2,
			d30Eligible: 2,
			d30Achieved: 1,
			d7RetainedActivatedUsers: 2,
		});
	});

	it("측정 시작과 cohort 후보 범위를 위한 성장 지표 인덱스를 제공한다", async () => {
		// When - 실제 migration이 만든 관련 인덱스를 조회하면
		const indexes = await prisma.$queryRaw<Array<{ indexdef: string }>>`
			SELECT indexdef
			FROM pg_indexes
			WHERE schemaname = 'public'
				AND tablename IN ('User', 'UserActivityDay')
		`;

		// Then - 정확한 MIN과 삭제 제외 가입 범위가 index scan 가능한 구조다
		expect(indexes.map(({ indexdef }) => indexdef)).toEqual(
			expect.arrayContaining([
				expect.stringContaining(
					'ON public."UserActivityDay" USING btree ("firstSeenAt")',
				),
				expect.stringContaining(
					'ON public."User" USING btree ("deletedAt", "createdAt")',
				),
			]),
		);
	});
});

function createActivityWriter(prisma: PrismaClient): UserRepository {
	const txHost = {
		tx: prisma,
	} as unknown as TransactionHost<TransactionalAdapterPrisma<DatabaseService>>;
	return new UserRepository(txHost);
}

async function seedGrowthScenario(prisma: PrismaClient): Promise<void> {
	const users = [
		{
			id: "pre-measurement",
			email: "pre@example.com",
			userTag: "GROW0001",
			createdAt: new Date("2026-05-31T12:00:00.000Z"),
		},
		{
			id: "activated-retained",
			email: "activated@example.com",
			userTag: "GROW0002",
			createdAt: new Date("2026-06-01T15:30:00.000Z"),
		},
		{
			id: "not-activated",
			email: "inactive@example.com",
			userTag: "GROW0003",
			createdAt: new Date("2026-06-10T10:00:00.000Z"),
		},
		{
			id: "immature-d30",
			email: "immature@example.com",
			userTag: "GROW0004",
			createdAt: new Date("2026-07-20T10:00:00.000Z"),
		},
	];
	await prisma.user.createMany({
		data: users.map((user) => ({ ...user, status: "ACTIVE" })),
	});
	await prisma.userActivityDay.createMany({
		data: [
			activity(
				"pre-measurement",
				"2026-06-02",
				"Pacific/Kiritimati",
				"2026-06-01T00:00:00.000Z",
			),
			activity(
				"activated-retained",
				"2026-06-02",
				"Asia/Seoul",
				"2026-06-02T01:00:00.000Z",
			),
			activity(
				"activated-retained",
				"2026-06-03",
				"Asia/Seoul",
				"2026-06-03T01:00:00.000Z",
			),
			activity(
				"activated-retained",
				"2026-06-09",
				"Asia/Seoul",
				"2026-06-09T01:00:00.000Z",
			),
			activity(
				"activated-retained",
				"2026-07-02",
				"Asia/Seoul",
				"2026-07-02T01:00:00.000Z",
			),
			activity(
				"not-activated",
				"2026-06-11",
				"UTC",
				"2026-06-11T10:00:00.000Z",
			),
			activity("immature-d30", "2026-07-21", "UTC", "2026-07-21T10:00:00.000Z"),
			activity("immature-d30", "2026-07-27", "UTC", "2026-07-27T10:00:00.000Z"),
		],
	});

	for (const user of users) {
		await prisma.todoCategory.create({
			data: {
				userId: user.id,
				name: `category-${user.id}`,
				color: "#000000",
			},
		});
	}
	const categories = await prisma.todoCategory.findMany({
		select: { id: true, userId: true },
	});
	const categoryByUser = new Map(categories.map((row) => [row.userId, row.id]));
	const activatedCategory = categoryByUser.get("activated-retained");
	const immatureCategory = categoryByUser.get("immature-d30");
	if (!activatedCategory || !immatureCategory) {
		throw new Error("growth fixture categories were not created");
	}
	const activatedSignup = users[1]?.createdAt;
	const immatureSignup = users[3]?.createdAt;
	if (!activatedSignup || !immatureSignup) {
		throw new Error("growth fixture users were not created");
	}
	await prisma.todo.createMany({
		data: [
			{
				userId: "activated-retained",
				categoryId: activatedCategory,
				title: "created within window",
				startDate: new Date("2026-06-02T00:00:00.000Z"),
				createdAt: new Date(activatedSignup.getTime() + 60 * 60 * 1000),
				completed: false,
			},
			{
				userId: "activated-retained",
				categoryId: activatedCategory,
				title: "completed within window",
				startDate: new Date("2026-06-02T00:00:00.000Z"),
				createdAt: new Date(activatedSignup.getTime() - 60 * 60 * 1000),
				completed: true,
				completedAt: new Date(activatedSignup.getTime() + 2 * 60 * 60 * 1000),
			},
			{
				userId: "immature-d30",
				categoryId: immatureCategory,
				title: "activated",
				startDate: new Date("2026-07-20T00:00:00.000Z"),
				createdAt: new Date(immatureSignup.getTime() + 60 * 60 * 1000),
				completed: true,
				completedAt: new Date(immatureSignup.getTime() + 2 * 60 * 60 * 1000),
			},
		],
	});
}

async function seedDeletedGrowthUser(prisma: PrismaClient): Promise<void> {
	const signupAt = new Date("2026-06-01T10:00:00.000Z");
	await prisma.user.create({
		data: {
			id: "deleted-growth-user",
			email: "deleted-growth@example.com",
			userTag: "GROW0005",
			status: "ACTIVE",
			createdAt: signupAt,
			deletedAt: new Date("2026-07-31T00:00:00.000Z"),
		},
	});
	const category = await prisma.todoCategory.create({
		data: {
			userId: "deleted-growth-user",
			name: "deleted-user-category",
			color: "#000000",
		},
	});
	await prisma.todo.createMany({
		data: [
			{
				userId: "deleted-growth-user",
				categoryId: category.id,
				title: "deleted created",
				startDate: new Date("2026-06-01T00:00:00.000Z"),
				createdAt: new Date(signupAt.getTime() + 60 * 60 * 1000),
				completed: false,
			},
			{
				userId: "deleted-growth-user",
				categoryId: category.id,
				title: "deleted completed",
				startDate: new Date("2026-06-01T00:00:00.000Z"),
				createdAt: signupAt,
				completed: true,
				completedAt: new Date(signupAt.getTime() + 2 * 60 * 60 * 1000),
			},
		],
	});
	await prisma.userActivityDay.createMany({
		data: [
			activity(
				"deleted-growth-user",
				"2026-06-02",
				"UTC",
				"2026-06-02T10:00:00.000Z",
			),
			activity(
				"deleted-growth-user",
				"2026-06-08",
				"UTC",
				"2026-06-08T10:00:00.000Z",
			),
			activity(
				"deleted-growth-user",
				"2026-07-01",
				"UTC",
				"2026-07-01T10:00:00.000Z",
			),
			activity(
				"deleted-growth-user",
				"2026-07-30",
				"UTC",
				"2026-07-30T10:00:00.000Z",
			),
		],
	});
}

function activity(
	userId: string,
	localDate: string,
	timezone: string,
	seenAt: string,
) {
	const timestamp = new Date(seenAt);
	return {
		userId,
		localDate: new Date(`${localDate}T00:00:00.000Z`),
		timezone,
		firstSeenAt: timestamp,
		lastSeenAt: timestamp,
	};
}
