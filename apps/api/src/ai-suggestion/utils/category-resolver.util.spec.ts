/**
 * category-resolver.util — 순수 함수 유닛 테스트
 */
import type { TodoSummaryForAnalysis } from "../types";
import { resolveSuggestedCategoryId } from "./category-resolver.util";

const makeTodo = (
	overrides: Partial<TodoSummaryForAnalysis> = {},
): TodoSummaryForAnalysis => ({
	title: "기본 할일",
	startDate: "2026-04-01",
	scheduledTime: null,
	categoryId: 1,
	completed: false,
	categoryName: "일반",
	...overrides,
});

describe("resolveSuggestedCategoryId — 제안 카테고리 해석", () => {
	it("제목 단어가 사용자 카테고리명과 일치하면 해당 카테고리를 우선 반환", () => {
		// Given — 매칭 todo 는 자기계발(id=5), 사용자에게는 운동(id=30) 카테고리도 존재
		const todos: TodoSummaryForAnalysis[] = [
			makeTodo({ title: "매칭A", categoryId: 5, categoryName: "자기계발" }),
			makeTodo({ title: "매칭B", categoryId: 5, categoryName: "자기계발" }),
			makeTodo({ title: "다른할일", categoryId: 30, categoryName: "운동" }),
		];

		// When — "운동 30분" 제안
		const result = resolveSuggestedCategoryId(
			"운동 30분",
			["매칭A", "매칭B"],
			todos,
		);

		// Then — 제목 매칭(30) 이 최빈(5) 보다 우선
		expect(result).toBe(30);
	});

	it("제목 매칭 없고 매칭된 투두가 있으면 최빈 카테고리", () => {
		// Given — 제목에 카테고리명 포함 안 됨
		const todos: TodoSummaryForAnalysis[] = [
			makeTodo({ title: "팀 미팅", categoryId: 3, categoryName: "업무" }),
			makeTodo({ title: "팀 미팅", categoryId: 3, categoryName: "업무" }),
			makeTodo({ title: "팀 미팅", categoryId: 5, categoryName: "일반" }),
		];

		// When
		const result = resolveSuggestedCategoryId(
			"팀 미팅",
			["팀 미팅", "팀 미팅", "팀 미팅"],
			todos,
		);

		// Then — 최빈 3
		expect(result).toBe(3);
	});

	it("제목 매칭 없고 매칭된 투두도 없으면 null", () => {
		// Given
		const todos: TodoSummaryForAnalysis[] = [
			makeTodo({ title: "공부", categoryName: "자기계발" }),
		];

		// When
		const result = resolveSuggestedCategoryId(
			"영화 감상",
			["존재하지않음"],
			todos,
		);

		// Then
		expect(result).toBeNull();
	});

	it("todos 가 비어 있으면 null", () => {
		// Given
		// When
		const result = resolveSuggestedCategoryId("뭔가", [], []);

		// Then
		expect(result).toBeNull();
	});

	it("카테고리명이 제목에 완전 일치해야 매칭 (부분 문자열 매칭 금지)", () => {
		// Given — 카테고리명 "운동", 제목 "운동장 관리"
		//  → "운동장" 은 "운동" 과 다른 어절이라 매칭 안 됨
		const todos: TodoSummaryForAnalysis[] = [
			makeTodo({ title: "매칭", categoryId: 5, categoryName: "일반" }),
			makeTodo({ title: "타인", categoryId: 30, categoryName: "운동" }),
		];

		// When
		const result = resolveSuggestedCategoryId("운동장 관리", ["매칭"], todos);

		// Then — "운동" 완전 일치 없어서 최빈 5 로 fallback
		expect(result).toBe(5);
	});
});
