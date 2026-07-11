/**
 * friend-reorder — 친구 목록 재정렬 순수 도메인 서비스.
 *
 * 친구(맞팔) 목록의 sortOrder 재배치 계획을 순수 함수로 계산한다. DB 접근이나
 * 프레임워크 의존 없이, 현재/대상 sortOrder만으로 새 sortOrder와 사이 구간 시프트를
 * 결정한다. 레거시 FollowService.#reorderRelativeTo / #reorderToEdge 알고리즘과 동등하다.
 */

export type ReorderPosition = "before" | "after";

/** 재정렬 시 사이 구간을 일괄 이동시키는 계획 (`to`가 null이면 끝까지) */
export interface ReorderShift {
	from: number;
	to: number | null;
	delta: number;
}

/** 재정렬 계획: 이동 대상의 새 sortOrder + 사이 구간 시프트 */
export interface ReorderPlan {
	newSortOrder: number;
	shift: ReorderShift;
}

/**
 * 기준 친구(targetSortOrder)의 앞/뒤로 이동하는 계획을 계산한다.
 */
export function planReorderRelativeTo(
	currentSortOrder: number,
	targetSortOrder: number,
	position: ReorderPosition,
): ReorderPlan {
	const desired = position === "before" ? targetSortOrder : targetSortOrder + 1;

	if (currentSortOrder < desired) {
		// 뒤로 이동: 사이 블록을 앞으로 당기고(-1) 목적지를 보정한다.
		return {
			newSortOrder: desired - 1,
			shift: { from: currentSortOrder + 1, to: desired - 1, delta: -1 },
		};
	}

	// 앞으로 이동: 사이 블록을 뒤로 밀고(+1) 목적지에 삽입한다.
	return {
		newSortOrder: desired,
		shift: { from: desired, to: currentSortOrder - 1, delta: 1 },
	};
}

/**
 * 목록의 맨 앞(before) 또는 맨 뒤(after)로 이동하는 계획을 계산한다.
 */
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
