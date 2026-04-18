/**
 * AI Suggestion 의 suggestedCategoryId 결정 순수 함수.
 *
 * 우선순위:
 *   1) 제목 단어가 사용자 카테고리명과 완전 일치하면 해당 카테고리
 *   2) 매칭된 투두들의 최빈 카테고리
 *   3) 위 둘 다 아니면 null
 *
 * Live QA 에서 발견된 "운동 30분" 제안이 자기계발 카테고리로 잘못 할당되던
 * 문제를 1단계 매칭으로 예방한다.
 */
import type { TodoSummaryForAnalysis } from "../types";

/**
 * 제안 제목 + 매칭 투두 기반으로 추천 카테고리 ID 를 결정.
 */
export function resolveSuggestedCategoryId(
	title: string,
	matchedTitles: string[],
	todos: TodoSummaryForAnalysis[],
): number | null {
	const categoryByName = buildCategoryNameMap(todos);
	const titleMatch = matchTitleToCategory(title, categoryByName);
	if (titleMatch !== null) {
		return titleMatch;
	}

	return pickMostFrequentCategoryId(matchedTitles, todos);
}

/** todos 배열에서 `categoryName -> categoryId` 최초 등장 매핑 추출. */
function buildCategoryNameMap(
	todos: TodoSummaryForAnalysis[],
): Map<string, number> {
	const map = new Map<string, number>();
	for (const t of todos) {
		if (!t.categoryName) {
			continue;
		}
		if (map.has(t.categoryName)) {
			continue;
		}
		map.set(t.categoryName, t.categoryId);
	}
	return map;
}

/** 제목 어절 중 카테고리명과 일치하는 게 있으면 해당 ID, 없으면 null. */
function matchTitleToCategory(
	title: string,
	categoryByName: Map<string, number>,
): number | null {
	const titleWords = new Set(title.split(/\s+/).filter(Boolean));
	for (const [name, id] of categoryByName) {
		if (titleWords.has(name)) {
			return id;
		}
	}
	return null;
}

/** matchedTitles 에 대응되는 todos 의 최빈 카테고리 ID. */
function pickMostFrequentCategoryId(
	matchedTitles: string[],
	todos: TodoSummaryForAnalysis[],
): number | null {
	const matched = todos.filter((t) =>
		matchedTitles.some((mt) => t.title === mt),
	);
	if (matched.length === 0) {
		return null;
	}

	const freq = new Map<number, number>();
	for (const t of matched) {
		freq.set(t.categoryId, (freq.get(t.categoryId) ?? 0) + 1);
	}

	let maxId: number | null = null;
	let maxCount = 0;
	for (const [categoryId, count] of freq) {
		if (count > maxCount) {
			maxId = categoryId;
			maxCount = count;
		}
	}
	return maxId;
}
