import type { ReorderPosition } from "@aido/validators";

/**
 * sortOrder 범위 시프트 지시
 *
 * `[from, to]` 구간(to가 null이면 끝까지)의 sortOrder를 delta만큼 이동합니다.
 */
export interface SortOrderShift {
	from: number;
	to: number | null;
	delta: 1 | -1;
}

/** 순서 변경 계산 결과 — 시프트할 구간과 이동 대상의 새 sortOrder */
export interface ReorderPlan {
	newSortOrder: number;
	shift: SortOrderShift;
}

/**
 * 기준 할 일의 앞/뒤로 이동하는 계획을 계산합니다 (순수 도메인 정책).
 *
 * - 아래로 이동: 사이 구간 `[current+1, new-1]`을 위로 당기고 최종 위치는 한 칸 앞
 * - 위로 이동: 사이 구간 `[new, current-1]`을 아래로 밀어냄
 */
export function planReorderRelativeTo(
	currentSortOrder: number,
	targetSortOrder: number,
	position: ReorderPosition,
): ReorderPlan {
	const desired = position === "before" ? targetSortOrder : targetSortOrder + 1;

	if (currentSortOrder < desired) {
		return {
			newSortOrder: desired - 1,
			shift: { from: currentSortOrder + 1, to: desired - 1, delta: -1 },
		};
	}

	return {
		newSortOrder: desired,
		shift: { from: desired, to: currentSortOrder - 1, delta: 1 },
	};
}

/**
 * 맨 앞(before) 또는 맨 뒤(after)로 이동하는 계획을 계산합니다 (순수 도메인 정책).
 *
 * @param maxSortOrder 맨 뒤 이동 시 사용할 현재 최대 sortOrder (시프트 전 기준)
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
