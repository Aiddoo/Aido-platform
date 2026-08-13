import { TodoCategory } from "./todo-category.aggregate";

const props = {
	id: 1,
	userId: "u1",
	name: "업무",
	color: "#FFB3B3",
	sortOrder: 0,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

describe("TodoCategory", () => {
	it("reconstitute + getters", () => {
		const category = TodoCategory.reconstitute(props);
		expect(category.id).toBe(1);
		expect(category.userId).toBe("u1");
		expect(category.name).toBe("업무");
		expect(category.color).toBe("#FFB3B3");
		expect(category.sortOrder).toBe(0);
		expect(category.createdAt).toEqual(props.createdAt);
		expect(category.updatedAt).toEqual(props.updatedAt);
	});

	it("isOwnedBy: 소유자 판별", () => {
		const category = TodoCategory.reconstitute(props);
		expect(category.isOwnedBy("u1")).toBe(true);
		expect(category.isOwnedBy("u2")).toBe(false);
	});
});
