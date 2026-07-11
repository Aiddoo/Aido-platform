/**
 * 메모 재정렬 도메인 서비스 (순수).
 *
 * 수동 정렬(sortOrder)은 "고정 여부 → sortOrder 내림차순 → id 내림차순"으로
 * 노출된다. 상대/양끝 이동 시 새 sortOrder와 사이 구간의 시프트 계획을 계산한다.
 * 실제 시프트/갱신은 인프라(저장소)가 수행한다.
 */

/** 사이 구간 sortOrder 일괄 증감 계획 (to=null 이면 끝까지). */
export interface ReorderShift {
	from: number;
	to: number | null;
	delta: number;
}

/** 재정렬 계획: 대상의 새 sortOrder + 사이 구간 시프트. */
export interface ReorderPlan {
	newSortOrder: number;
	shift: ReorderShift;
}

/**
 * 기준 메모(targetSortOrder) 대비 상대 이동 계획.
 *
 * before = 기준 앞, after = 기준 뒤. 현재 위치가 목표보다 앞이면 사이 블록을
 * 한 칸 당기고(-1) 목표도 한 칸 보정, 뒤면 사이 블록을 한 칸 민다(+1).
 */
export function planReorderRelativeTo(
	currentSortOrder: number,
	targetSortOrder: number,
	position: "before" | "after",
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
 * 양끝 이동 계획. before = 맨 앞(sortOrder 0), after = 맨 뒤(maxSortOrder).
 * after 는 호출부가 조회한 maxSortOrder 를 전달해야 한다.
 */
export function planReorderToEdge(
	currentSortOrder: number,
	position: "before" | "after",
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
