import { planReorderRelativeTo, planReorderToEdge } from "./category-reorder";

describe("category-reorder 도메인 서비스", () => {
	describe("planReorderRelativeTo", () => {
		it("아래로 이동(current<desired): 사이 구간을 당기고 자신은 desired-1", () => {
			// current=0을 target=2 뒤로 → desired=3, current<desired
			expect(planReorderRelativeTo(0, 2, "after")).toEqual({
				newSortOrder: 2,
				shift: { from: 1, to: 2, delta: -1 },
			});
		});

		it("위로 이동(current>=desired): 사이 구간을 밀고 자신은 desired", () => {
			// current=2를 target=0 앞으로 → desired=0
			expect(planReorderRelativeTo(2, 0, "before")).toEqual({
				newSortOrder: 0,
				shift: { from: 0, to: 1, delta: 1 },
			});
		});

		it("before는 target sortOrder를, after는 target+1을 기준으로 한다", () => {
			expect(planReorderRelativeTo(5, 3, "before").newSortOrder).toBe(3);
			expect(planReorderRelativeTo(5, 3, "after").newSortOrder).toBe(4);
		});
	});

	describe("planReorderToEdge", () => {
		it("맨 앞(before): [0, current-1]을 밀고 자신은 0", () => {
			expect(planReorderToEdge(2, "before", 5)).toEqual({
				newSortOrder: 0,
				shift: { from: 0, to: 1, delta: 1 },
			});
		});

		it("맨 뒤(after): [current+1, 끝]을 당기고 자신은 maxSortOrder", () => {
			expect(planReorderToEdge(0, "after", 5)).toEqual({
				newSortOrder: 5,
				shift: { from: 1, to: null, delta: -1 },
			});
		});
	});
});
