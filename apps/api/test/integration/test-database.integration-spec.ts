import contractJson from "../../src/generated/prisma8/contract.json" with { type: "json" };
import { TestDatabase } from "../setup/test-database.js";

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
		const prisma = testDatabase.getClient();

		const markers = await prisma
			.runtime()
			.query(
				prisma.raw.sql`SELECT core_hash FROM prisma_contract.marker WHERE space = 'app'`
					.returnsRow({ core_hash: "pg/text@1" })
					.build(),
			);
		expect(markers).toEqual([{ core_hash: contractJson.storage.storageHash }]);
		const legacyHistory = await prisma
			.runtime()
			.query(
				prisma.raw.sql`SELECT to_regclass('public._prisma_migrations')::text AS history`
					.returnsRow({ history: { codecId: "pg/text@1", nullable: true } })
					.build(),
			);
		expect(legacyHistory).toEqual([{ history: null }]);
	});

	it("cleanup이 public 데이터와 sequence를 초기화해야 한다", async () => {
		// Given - 독립 컨테이너에 sequence 검증용 임시 테이블 생성
		const prisma = testDatabase.getClient();
		await prisma
			.runtime()
			.execute(
				prisma.raw.sql`CREATE TABLE "TestSequenceReset" ("id" SERIAL PRIMARY KEY)`
					.affectedCount()
					.build(),
			);

		try {
			const first = await prisma
				.runtime()
				.query(
					prisma.raw.sql`INSERT INTO "TestSequenceReset" DEFAULT VALUES RETURNING "id"`
						.returnsRow({ id: "pg/int4@1" })
						.build(),
				);
			expect(first[0]?.id).toBe(1);

			// When - 공용 cleanup 후 다시 insert
			await testDatabase.cleanup();
			const second = await prisma
				.runtime()
				.query(
					prisma.raw.sql`INSERT INTO "TestSequenceReset" DEFAULT VALUES RETURNING "id"`
						.returnsRow({ id: "pg/int4@1" })
						.build(),
				);

			// Then - 데이터와 sequence가 모두 초기화됨
			expect(second[0]?.id).toBe(1);
		} finally {
			await prisma
				.runtime()
				.execute(prisma.raw.sql`DROP TABLE IF EXISTS "TestSequenceReset"`.affectedCount().build());
		}
	});
});
