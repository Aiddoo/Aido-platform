import { TestDatabase } from "../setup/test-database";

describe("TestDatabase 통합 테스트 (실제 DB)", () => {
	let testDatabase: TestDatabase;

	beforeAll(async () => {
		testDatabase = new TestDatabase();
		await testDatabase.start();
	});

	afterAll(async () => {
		await testDatabase.stop();
	});

	it("globalSetup에서 Prisma migration이 적용되어 있어야 한다", async () => {
		// Given - globalSetup이 완료된 관리형 테스트 DB
		const prisma = testDatabase.getPrisma();

		// When - 성공한 migration 수 조회
		const migrations = await prisma.$queryRaw<Array<{ count: bigint }>>`
			SELECT COUNT(*) AS count
			FROM "_prisma_migrations"
			WHERE finished_at IS NOT NULL
				AND rolled_back_at IS NULL
		`;

		// Then - 최소 하나 이상의 migration이 적용됨
		expect(Number(migrations[0]?.count)).toBeGreaterThan(0);
	});

	it("cleanup이 public 데이터와 sequence를 초기화해야 한다", async () => {
		// Given - 독립 컨테이너에 sequence 검증용 임시 테이블 생성
		const prisma = testDatabase.getPrisma();
		await prisma.$executeRawUnsafe(
			'CREATE TABLE "TestSequenceReset" ("id" SERIAL PRIMARY KEY)',
		);

		try {
			const first = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
				'INSERT INTO "TestSequenceReset" DEFAULT VALUES RETURNING "id"',
			);
			expect(first[0]?.id).toBe(1);

			// When - 공용 cleanup 후 다시 insert
			await testDatabase.cleanup();
			const second = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
				'INSERT INTO "TestSequenceReset" DEFAULT VALUES RETURNING "id"',
			);

			// Then - 데이터와 sequence가 모두 초기화됨
			expect(second[0]?.id).toBe(1);
		} finally {
			await prisma.$executeRawUnsafe(
				'DROP TABLE IF EXISTS "TestSequenceReset"',
			);
		}
	});
});
