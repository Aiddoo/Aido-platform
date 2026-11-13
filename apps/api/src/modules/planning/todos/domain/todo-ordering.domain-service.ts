import type { ReorderPosition } from "@aido/api/vocabulary";

import { sortOrderBetween } from "../../shared/domain/todo-sort-order.domain-service.js";

/** 기준 할 일과, 옮길 할 일을 뺀 그 반대쪽 바로 옆 할 일(없으면 null)의 sortOrder */
export interface ReorderNeighbors {
  readonly target: number;
  readonly beyond: number | null;
}

/**
 * 기준 할 일 앞이면 (앞 이웃, 기준), 뒤면 (기준, 뒤 이웃) 사이에 둘 새 sortOrder다.
 * 사이에 정수가 없으면 null이라 그 사용자 할 일을 다시 번호 매긴 뒤 다시 계산한다
 */
export function planReorderRelativeTo(
  position: ReorderPosition,
  { target, beyond }: ReorderNeighbors,
): number | null {
  return position === "before"
    ? sortOrderBetween(beyond, target)
    : sortOrderBetween(target, beyond);
}

/**
 * 맨 앞(before)·맨 끝(after)에 둘 새 sortOrder다. edge는 옮길 할 일을 뺀 가장 앞·끝 값(없으면 null)이다.
 * 자리가 없으면 null이다
 */
export function planReorderToEdge(position: ReorderPosition, edge: number | null): number | null {
  return position === "before" ? sortOrderBetween(null, edge) : sortOrderBetween(edge, null);
}
