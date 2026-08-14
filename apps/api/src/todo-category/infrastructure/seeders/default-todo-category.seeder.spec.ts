/**
 * DefaultTodoCategorySeeder(시딩 전용) 단위 테스트
 *
 * 회원가입 기본 카테고리 시딩 경로만 검증한다. 컨트롤러 경로는 클린아키텍처 어댑터
 * (PrismaTodoCategoryRepository)가 담당한다.
 */

import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TestBed } from "@suites/unit";
import { createMockPrisma, type MockPrismaClient } from "@test/mocks";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import { DefaultTodoCategorySeeder } from "./default-todo-category.seeder";

describe("DefaultTodoCategorySeeder — 기본 카테고리 시딩", () => {
	let seeder: DefaultTodoCategorySeeder;
	let db: MockPrismaClient;

	beforeEach(async () => {
		db = createMockPrisma();

		const { unit } = await TestBed.solitary(DefaultTodoCategorySeeder)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(
				TransactionHost,
			)
			.impl(() => ({ tx: db }))
			.compile();

		seeder = unit;
	});

	it("seed는 활성 트랜잭션에 기본 카테고리를 생성한다", async () => {
		db.todoCategory.createMany.mockResolvedValue({ count: 2 });

		const count = await seeder.seed("u1");

		expect(count).toBe(2);
		expect(db.todoCategory.createMany).toHaveBeenCalledWith({
			data: [
				{ userId: "u1", name: "중요한 일", color: "#FFB3B3", sortOrder: 0 },
				{ userId: "u1", name: "할 일", color: "#FF6B43", sortOrder: 1 },
			],
		});
	});

	it("명시적 tx가 주어지면 그 클라이언트를 사용한다", async () => {
		const txClient = createMockPrisma();
		txClient.todoCategory.createMany.mockResolvedValue({ count: 1 });
		const count = await seeder.seed("u1", txClient);

		expect(count).toBe(1);
		expect(txClient.todoCategory.createMany).toHaveBeenCalled();
		expect(db.todoCategory.createMany).not.toHaveBeenCalled();
	});
});
