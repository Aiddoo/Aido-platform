import { Friendship } from "./friendship.aggregate";

const make = (status: "PENDING" | "ACCEPTED", sortOrder = 0): Friendship =>
	Friendship.reconstitute({
		id: "f-1",
		followerId: "u1",
		followingId: "u2",
		status,
		sortOrder,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-02T00:00:00.000Z"),
	});

describe("Friendship 엔티티", () => {
	it("reconstitute와 getter", () => {
		const f = make("PENDING", 3);
		expect(f.id).toBe("f-1");
		expect(f.followerId).toBe("u1");
		expect(f.followingId).toBe("u2");
		expect(f.status).toBe("PENDING");
		expect(f.sortOrder).toBe(3);
	});

	it("상태 판별", () => {
		expect(make("PENDING").isPending()).toBe(true);
		expect(make("PENDING").isAccepted()).toBe(false);
		expect(make("ACCEPTED").isAccepted()).toBe(true);
	});

	it("수락하면 상태와 친구 정렬 순서를 함께 전이한다", () => {
		const friendship = make("PENDING");

		friendship.accept(4);

		expect(friendship.isAccepted()).toBe(true);
		expect(friendship.toUpdate()).toEqual({
			status: "ACCEPTED",
			sortOrder: 4,
		});
	});

	it("planReorderRelativeTo는 도메인 서비스와 동일 계획", () => {
		const plan = make("ACCEPTED", 5).planReorderRelativeTo(2, "before");
		expect(plan.newSortOrder).toBe(2);
		expect(plan.shift).toEqual({ from: 2, to: 4, delta: 1 });
	});

	it("planReorderToEdge(after)는 맨 뒤로", () => {
		const plan = make("ACCEPTED", 3).planReorderToEdge("after", 9);
		expect(plan.newSortOrder).toBe(9);
		expect(plan.shift).toEqual({ from: 4, to: null, delta: -1 });
	});
});
