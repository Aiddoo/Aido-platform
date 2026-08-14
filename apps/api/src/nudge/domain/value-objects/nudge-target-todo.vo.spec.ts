import { addDays, subtractDays } from "@/shared/domain/date/utils/arithmetic";

import { NudgeTargetTodo } from "./nudge-target-todo.vo";

const today = new Date("2026-01-10T00:00:00.000Z");

describe("NudgeTargetTodo", () => {
	it("isOwnedBy: 소유자 판별", () => {
		const todo = NudgeTargetTodo.of({
			ownerId: "r",
			visibility: "PUBLIC",
			startDate: today,
			endDate: null,
		});
		expect(todo.isOwnedBy("r")).toBe(true);
		expect(todo.isOwnedBy("s")).toBe(false);
	});

	it("isPublic: PUBLIC만 참", () => {
		const make = (visibility: string) =>
			NudgeTargetTodo.of({
				ownerId: "r",
				visibility,
				startDate: today,
				endDate: null,
			});
		expect(make("PUBLIC").isPublic()).toBe(true);
		expect(make("PRIVATE").isPublic()).toBe(false);
		expect(make("FRIENDS").isPublic()).toBe(false);
	});

	describe("isActiveOn", () => {
		it("당일 할 일: startDate가 오늘과 같으면 참", () => {
			const todo = NudgeTargetTodo.of({
				ownerId: "r",
				visibility: "PUBLIC",
				startDate: today,
				endDate: null,
			});
			expect(todo.isActiveOn(today)).toBe(true);
			expect(todo.isActiveOn(subtractDays(1, today))).toBe(false);
		});

		it("기간 할 일: 오늘이 [start, end] 안이면 참", () => {
			const todo = NudgeTargetTodo.of({
				ownerId: "r",
				visibility: "PUBLIC",
				startDate: subtractDays(2, today),
				endDate: addDays(2, today),
			});
			expect(todo.isActiveOn(today)).toBe(true);
		});

		it("기간 할 일: 오늘이 기간 밖이면 거짓", () => {
			const todo = NudgeTargetTodo.of({
				ownerId: "r",
				visibility: "PUBLIC",
				startDate: subtractDays(5, today),
				endDate: subtractDays(2, today),
			});
			expect(todo.isActiveOn(today)).toBe(false);
		});
	});
});
