import type { TodoCategoryWithCountView } from "../application/ports/todo-category.repository.port";
import { TodoCategory } from "../domain/entities/todo-category.aggregate";
import { TodoCategoryMapper } from "./todo-category.mapper";

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const updatedAt = new Date("2026-01-02T00:00:00.000Z");

const aggregate = TodoCategory.reconstitute({
	id: 1,
	userId: "u1",
	name: "업무",
	color: "#FFB3B3",
	sortOrder: 0,
	createdAt,
	updatedAt,
});

const view: TodoCategoryWithCountView = {
	id: 2,
	userId: "u1",
	name: "할 일",
	color: "#FF6B43",
	sortOrder: 1,
	createdAt,
	updatedAt,
	todoCount: 5,
};

describe("TodoCategoryMapper", () => {
	it("toResponse: 애그리게잇 → DTO + ISO 직렬화", () => {
		expect(TodoCategoryMapper.toResponse(aggregate)).toEqual({
			id: 1,
			userId: "u1",
			name: "업무",
			color: "#FFB3B3",
			sortOrder: 0,
			createdAt: createdAt.toISOString(),
			updatedAt: updatedAt.toISOString(),
		});
	});

	it("toResponseWithCount: 프로젝션 → todoCount 포함 DTO", () => {
		expect(TodoCategoryMapper.toResponseWithCount(view)).toEqual({
			id: 2,
			userId: "u1",
			name: "할 일",
			color: "#FF6B43",
			sortOrder: 1,
			createdAt: createdAt.toISOString(),
			updatedAt: updatedAt.toISOString(),
			todoCount: 5,
		});
	});

	it("toManyResponseWithCount: 목록 매핑", () => {
		expect(TodoCategoryMapper.toManyResponseWithCount([view])).toHaveLength(1);
	});
});
