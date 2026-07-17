import { TestDatabase } from "./test-database";

describe("TestDatabase", () => {
	it("비관리 DATABASE_URL에서 Prisma 연결을 시도하지 않아야 한다", async () => {
		// Given - localhost fallback URL과 Prisma factory spy
		const createPrismaClient = jest.fn();
		const testDatabase = new TestDatabase({
			env: {
				DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/aido_test",
			},
			createPrismaClient,
		});

		// When & Then - marker/name 검증에서 즉시 중단
		await expect(testDatabase.start()).rejects.toThrow(
			"AIDO_TEST_DB_MANAGED=1",
		);
		expect(createPrismaClient).not.toHaveBeenCalled();
	});
});
