import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { TodoCategoryRepository } from "../todo-category.repository";
import { UserRegisteredCategoryListener } from "./user-registered-category.listener";

describe("UserRegisteredCategoryListener", () => {
	let listener: UserRegisteredCategoryListener;
	let todoCategoryRepo: Mocked<TodoCategoryRepository>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			UserRegisteredCategoryListener,
		).compile();

		listener = unit;
		todoCategoryRepo = unitRef.get(
			TodoCategoryRepository,
		) as unknown as Mocked<TodoCategoryRepository>;
	});

	const payload = {
		userId: "user-123",
		email: "test@example.com",
		provider: "credential" as const,
		registeredAt: new Date().toISOString(),
	};

	it("신규 사용자에게 기본 카테고리 2개를 생성한다", async () => {
		// Given
		todoCategoryRepo.countByUserId.mockResolvedValue(0);
		todoCategoryRepo.createMany.mockResolvedValue(2);

		// When
		await listener.handleUserRegistered(payload);

		// Then
		expect(todoCategoryRepo.createMany).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					userId: "user-123",
					name: "중요한 일",
					color: "#FFB3B3",
					sortOrder: 0,
				}),
				expect.objectContaining({
					userId: "user-123",
					name: "할 일",
					color: "#FF6B43",
					sortOrder: 1,
				}),
			]),
		);
	});

	it("이미 카테고리가 존재하면 생성하지 않는다 (idempotent)", async () => {
		// Given
		todoCategoryRepo.countByUserId.mockResolvedValue(2);

		// When
		await listener.handleUserRegistered(payload);

		// Then
		expect(todoCategoryRepo.createMany).not.toHaveBeenCalled();
	});

	it("카테고리 생성 실패 시 에러를 삼킨다 (회원가입에 영향 없음)", async () => {
		// Given
		todoCategoryRepo.countByUserId.mockResolvedValue(0);
		todoCategoryRepo.createMany.mockRejectedValue(
			new Error("DB connection error"),
		);

		// When & Then - 에러가 throw되지 않음
		await expect(listener.handleUserRegistered(payload)).resolves.not.toThrow();
	});
});
