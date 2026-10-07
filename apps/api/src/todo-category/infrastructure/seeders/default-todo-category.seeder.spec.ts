import { createMockTransactionHost, databaseWriteExpectation } from "#test/mocks/database.mock";
/**
 * DefaultTodoCategorySeeder(시딩 전용) 단위 테스트
 *
 * 회원가입 기본 카테고리 시딩 경로만 검증한다. 컨트롤러 경로는 클린아키텍처 어댑터
 * (PrismaTodoCategoryRepository)가 담당한다.
 */
import { createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";

import { DefaultTodoCategorySeeder } from "./default-todo-category.seeder.js";

describe("DefaultTodoCategorySeeder — 기본 카테고리 시딩", () => {
	let seeder: DefaultTodoCategorySeeder;
	let db: MockDatabaseContext;

	beforeEach(async () => {
		db = createMockDatabaseContext();

		seeder = new DefaultTodoCategorySeeder(createMockTransactionHost(db));
	});

	it("seed는 활성 트랜잭션에 기본 카테고리를 생성한다", async () => {
		db.orm.public.TodoCategory.createAndCount.mockResolvedValue(2);

		const count = await seeder.seed("u1");

		expect(count).toBe(2);
		expect(db.orm.public.TodoCategory.createAndCount).toHaveBeenCalledWith([
			expect.objectContaining(
				databaseWriteExpectation("TodoCategory", {
					userId: "u1",
					name: "중요한 일",
					color: "#FFB3B3",
					sortOrder: 0,
				}),
			),
			expect.objectContaining(
				databaseWriteExpectation("TodoCategory", {
					userId: "u1",
					name: "할 일",
					color: "#FF6B43",
					sortOrder: 1,
				}),
			),
		]);
	});

	it("활성 CLS tx가 바뀌면 그 클라이언트를 사용한다", async () => {
		const txClient = createMockDatabaseContext();
		txClient.orm.public.TodoCategory.createAndCount.mockResolvedValue(1);
		Object.defineProperty(seeder, "txHost", { value: { tx: txClient } });
		const count = await seeder.seed("u1");

		expect(count).toBe(1);
		expect(txClient.orm.public.TodoCategory.createAndCount).toHaveBeenCalled();
		expect(db.orm.public.TodoCategory.createAndCount).not.toHaveBeenCalled();
	});
});
