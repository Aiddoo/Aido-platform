import { TransactionHost } from "@nestjs-cls/transactional";
import { TestBed } from "@suites/unit";
import { vi, type MockedFunction } from "vitest";

import type { Prisma8TransactionalAdapter } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";
import { nativeSqlParameters } from "#test/mocks/database.mock";
import { createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";

import { PostgresMutationLockAdapter } from "./postgres-mutation-lock.adapter.js";

describe("PostgresMutationLockAdapter — 트랜잭션 advisory lock", () => {
	let adapter: PostgresMutationLockAdapter;
	let tx: MockDatabaseContext;
	let isTransactionActive: MockedFunction<() => boolean>;

	beforeEach(async () => {
		tx = createMockDatabaseContext();
		tx.query.mockResolvedValue([]);
		isTransactionActive = vi.fn(() => true);

		const { unit } = await TestBed.solitary(PostgresMutationLockAdapter)
			.mock<TransactionHost<Prisma8TransactionalAdapter>>(TransactionHost)
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

		// Then - JS 숫자 해시 없이 정렬·중복 제거한 키를 한 SQL 왕복으로 잠금
		expect(tx.query).toHaveBeenCalledTimes(1);
		expect(nativeSqlParameters(tx.query.mock.calls[0]?.[0])).toEqual([
			"mutation:v1:nudge:cooldown:user-1:42",
			"mutation:v1:nudge:daily:user-1:2026-07-26",
		]);
	});

	it("활성 트랜잭션이 아니면 SQL 전에 내부 invariant 오류로 실패한다", async () => {
		// Given - TransactionHost.tx가 기본 클라이언트로 fallback하는 UoW 외부
		isTransactionActive.mockReturnValue(false);

		// When / Then - autocommit xact lock을 획득한 척하지 않음
		await expect(adapter.acquire(["mutation:v1:cheer:daily:user-1:2026-07-26"])).rejects.toThrow(
			"Mutation lock requires an active transaction",
		);
		expect(tx.query).not.toHaveBeenCalled();
	});

	it("빈 키 목록이면 PostgreSQL을 호출하지 않는다", async () => {
		// Given - 잠글 mutation key가 없음

		// When
		await adapter.acquire([]);

		// Then
		expect(tx.query).not.toHaveBeenCalled();
	});
});
