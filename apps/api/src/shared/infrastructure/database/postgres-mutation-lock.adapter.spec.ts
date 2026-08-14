import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TestBed } from "@suites/unit";
import { createMockPrisma, type MockPrismaClient } from "@test/mocks";

import type { DatabaseService } from "./database.service";
import { PostgresMutationLockAdapter } from "./postgres-mutation-lock.adapter";

describe("PostgresMutationLockAdapter — 트랜잭션 advisory lock", () => {
	let adapter: PostgresMutationLockAdapter;
	let tx: MockPrismaClient;
	let isTransactionActive: jest.MockedFunction<() => boolean>;

	beforeEach(async () => {
		tx = createMockPrisma();
		tx.$queryRaw.mockResolvedValue([]);
		isTransactionActive = jest.fn(() => true);

		const { unit } = await TestBed.solitary(PostgresMutationLockAdapter)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(TransactionHost)
			.impl(() => ({ tx, isTransactionActive }))
			.compile();
		adapter = unit;
	});

	it("활성 TransactionHost 연결에서 중복 제거한 키를 정렬 순서로 parameterized advisory lock 한다", async () => {
		// Given - 중복되고 정렬되지 않은 논리 키
		const keys = [
			"mutation:v1:nudge:daily:user-1:2026-07-26",
			"mutation:v1:nudge:cooldown:user-1:42",
			"mutation:v1:nudge:daily:user-1:2026-07-26",
		];

		// When - transaction-scoped lock 획득
		await adapter.acquire(keys);

		// Then - JS 숫자 해시 없이 키가 SQL parameter로 전달되고 정렬 순서가 고정됨
		expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
		const firstCall = tx.$queryRaw.mock.calls[0];
		const secondCall = tx.$queryRaw.mock.calls[1];
		expect(firstCall?.[0]).toEqual([
			"SELECT pg_advisory_xact_lock(hashtextextended(",
			", 0))::text",
		]);
		expect(firstCall?.[1]).toBe("mutation:v1:nudge:cooldown:user-1:42");
		expect(secondCall?.[1]).toBe("mutation:v1:nudge:daily:user-1:2026-07-26");
	});

	it("활성 트랜잭션이 아니면 SQL 전에 내부 invariant 오류로 실패한다", async () => {
		// Given - TransactionHost.tx가 기본 클라이언트로 fallback하는 UoW 외부
		isTransactionActive.mockReturnValue(false);

		// When / Then - autocommit xact lock을 획득한 척하지 않음
		await expect(adapter.acquire(["mutation:v1:cheer:daily:user-1:2026-07-26"])).rejects.toThrow(
			"Mutation lock requires an active transaction",
		);
		expect(tx.$queryRaw).not.toHaveBeenCalled();
	});

	it("빈 키 목록이면 PostgreSQL을 호출하지 않는다", async () => {
		// Given - 잠글 mutation key가 없음

		// When
		await adapter.acquire([]);

		// Then
		expect(tx.$queryRaw).not.toHaveBeenCalled();
	});
});
