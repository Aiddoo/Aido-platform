import type { PrismaClient } from "../../src/generated/prisma/client";
import { TestDatabase } from "./test-database";

const MANAGED_ENV = {
	DATABASE_URL: "postgresql://test_user:test_password@localhost:55432/aido_test_abc123",
	AIDO_TEST_DB_MANAGED: "1",
};

/** 교착 재시도만 확인하면 되므로 cleanup이 부르는 두 메서드만 흉내 낸다. */
function createFakePrismaClient(executeRawUnsafe: jest.Mock) {
	return {
		$connect: jest.fn().mockResolvedValue(undefined),
		$disconnect: jest.fn().mockResolvedValue(undefined),
		$queryRaw: jest.fn().mockResolvedValue([{ table_name: "Todo" }]),
		$executeRawUnsafe: executeRawUnsafe,
	} as unknown as PrismaClient;
}

function deadlock() {
	return Object.assign(new Error("deadlock detected"), { code: "40P01" });
}

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
		await expect(testDatabase.start()).rejects.toThrow("AIDO_TEST_DB_MANAGED=1");
		expect(createPrismaClient).not.toHaveBeenCalled();
	});

	// TRUNCATE는 ACCESS EXCLUSIVE 락을 잡는다. 앞 테스트가 남긴 작업과 겹치면 교착으로
	// 튕기는데, 이건 드문 경합이지 설계 결함이 아니다 — 물러섰다 다시 잡는 게 맞다.
	describe("TRUNCATE 교착 재시도", () => {
		async function startWith(executeRawUnsafe: jest.Mock) {
			const testDatabase = new TestDatabase({
				env: MANAGED_ENV,
				createPrismaClient: () => createFakePrismaClient(executeRawUnsafe),
			});
			await testDatabase.start();
			return testDatabase;
		}

		it("교착으로 튕기면 다시 시도해 끝내 정리한다", async () => {
			const executeRawUnsafe = jest.fn().mockRejectedValueOnce(deadlock()).mockResolvedValueOnce(1);
			const testDatabase = await startWith(executeRawUnsafe);

			await expect(testDatabase.cleanup()).resolves.toBeUndefined();
			expect(executeRawUnsafe).toHaveBeenCalledTimes(2);
		});

		it("교착이 아닌 실패는 즉시 올린다 — 감추면 원인을 잃는다", async () => {
			const executeRawUnsafe = jest.fn().mockRejectedValue(new Error("relation does not exist"));
			const testDatabase = await startWith(executeRawUnsafe);

			await expect(testDatabase.cleanup()).rejects.toThrow("relation does not exist");
			expect(executeRawUnsafe).toHaveBeenCalledTimes(1);
		});

		it("계속 교착이면 무한정 매달리지 않고 마지막 실패를 올린다", async () => {
			const executeRawUnsafe = jest.fn().mockRejectedValue(deadlock());
			const testDatabase = await startWith(executeRawUnsafe);

			await expect(testDatabase.cleanup()).rejects.toThrow("deadlock detected");
			expect(executeRawUnsafe).toHaveBeenCalledTimes(3);
		});
	});
});
