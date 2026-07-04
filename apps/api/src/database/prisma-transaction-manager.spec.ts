/**
 * PrismaTransactionManager 단위 테스트
 *
 * Suites + GWT 패턴 적용
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { DatabaseService } from "./database.service";
import { PrismaTransactionManager } from "./prisma-transaction-manager";

describe("PrismaTransactionManager — 트랜잭션 매니저 어댑터", () => {
	let manager: PrismaTransactionManager;
	let database: Mocked<DatabaseService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			PrismaTransactionManager,
		).compile();

		manager = unit;
		database = unitRef.get(DatabaseService);
	});

	it("run은 database.$transaction에 콜백을 위임한다", async () => {
		// Given
		const txClient = { todo: {} };
		(database.$transaction as jest.Mock).mockImplementation(
			(callback: (tx: unknown) => Promise<unknown>) => callback(txClient),
		);
		const fn = jest.fn().mockResolvedValue("result");

		// When
		const result = await manager.run(fn);

		// Then
		expect(database.$transaction).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith(txClient);
		expect(result).toBe("result");
	});

	it("콜백에서 던진 예외를 그대로 전파한다", async () => {
		// Given
		const error = new Error("트랜잭션 실패");
		(database.$transaction as jest.Mock).mockImplementation(
			(callback: (tx: unknown) => Promise<unknown>) => callback({}),
		);
		const fn = jest.fn().mockRejectedValue(error);

		// When & Then
		await expect(manager.run(fn)).rejects.toThrow("트랜잭션 실패");
	});
});
