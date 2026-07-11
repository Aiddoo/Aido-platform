/**
 * friend-reorder 도메인 서비스 단위 테스트.
 *
 * 레거시 FollowService.#reorderRelativeTo / #reorderToEdge 알고리즘과 동등함을 검증한다
 * (새 sortOrder + 사이 구간 시프트 계획).
 */
import { planReorderRelativeTo, planReorderToEdge } from "./friend-reorder";

describe("friend-reorder — 재정렬 계획", () => {
	describe("planReorderRelativeTo", () => {
		it("앞으로 이동(current > target, before): 사이 블록을 +1 밀고 target에 삽입", () => {
			const plan = planReorderRelativeTo(5, 2, "before");
			expect(plan.newSortOrder).toBe(2);
			expect(plan.shift).toEqual({ from: 2, to: 4, delta: 1 });
		});

		it("뒤로 이동(current < target, after): 사이 블록을 -1 당기고 보정", () => {
			const plan = planReorderRelativeTo(1, 4, "after");
			expect(plan.newSortOrder).toBe(4);
			expect(plan.shift).toEqual({ from: 2, to: 4, delta: -1 });
		});

		it("뒤로 이동(current < target, before)", () => {
			const plan = planReorderRelativeTo(1, 4, "before");
			expect(plan.newSortOrder).toBe(3);
			expect(plan.shift).toEqual({ from: 2, to: 3, delta: -1 });
		});

		it("앞으로 이동(current > target, after)", () => {
			const plan = planReorderRelativeTo(5, 2, "after");
			expect(plan.newSortOrder).toBe(3);
			expect(plan.shift).toEqual({ from: 3, to: 4, delta: 1 });
		});
	});

	describe("planReorderToEdge", () => {
		it("before: 맨 앞(0)으로, 앞 블록을 +1 민다", () => {
			const plan = planReorderToEdge(3, "before", 9);
			expect(plan.newSortOrder).toBe(0);
			expect(plan.shift).toEqual({ from: 0, to: 2, delta: 1 });
		});

		it("after: 맨 뒤(max)로, 뒤 블록을 -1 당긴다 (to=null)", () => {
			const plan = planReorderToEdge(3, "after", 9);
			expect(plan.newSortOrder).toBe(9);
			expect(plan.shift).toEqual({ from: 4, to: null, delta: -1 });
		});
	});
});
