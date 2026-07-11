export type ReorderPosition = "before" | "after";

/** 재배치 계획: 대상 카테고리의 새 sortOrder + 사이에 낀 카테고리들의 시프트 범위/방향 */
export interface ReorderPlan {
	newSortOrder: number;
	shift: {
		from: number;
		to: number | null;
		delta: number;
	};
}

/**
 * category-reorder — 카테고리 정렬 재배치 순수 도메인 서비스.
 *
 * 현재 sortOrder와 대상 위치로부터 이동 카테고리의 새 sortOrder와, 그 사이에 낀 카테고리들을
 * 한 칸씩 밀거나 당기는 시프트 계획을 계산한다. 부수효과 없음(저장은 use-case가 수행).
 */

/** 특정 카테고리 기준 앞/뒤로 이동 */
export function planReorderRelativeTo(
	currentSortOrder: number,
	targetSortOrder: number,
	position: ReorderPosition,
): ReorderPlan {
	const desired = position === "before" ? targetSortOrder : targetSortOrder + 1;

	// 아래로 이동: [current+1, desired-1] 구간을 위로 당기고(-1), 자신은 desired-1로
	if (currentSortOrder < desired) {
		return {
			newSortOrder: desired - 1,
			shift: { from: currentSortOrder + 1, to: desired - 1, delta: -1 },
		};
	}

	// 위로 이동: [desired, current-1] 구간을 아래로 밀고(+1), 자신은 desired로
	return {
		newSortOrder: desired,
		shift: { from: desired, to: currentSortOrder - 1, delta: 1 },
	};
}

/** 목록의 맨 앞/맨 뒤로 이동 */
export function planReorderToEdge(
	currentSortOrder: number,
	position: ReorderPosition,
	maxSortOrder: number,
): ReorderPlan {
	if (position === "before") {
		return {
			newSortOrder: 0,
			shift: { from: 0, to: currentSortOrder - 1, delta: 1 },
		};
	}

	return {
		newSortOrder: maxSortOrder,
		shift: { from: currentSortOrder + 1, to: null, delta: -1 },
	};
}
