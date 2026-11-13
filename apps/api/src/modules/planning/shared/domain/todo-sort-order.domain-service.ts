/**
 * 할 일 sortOrder는 사이를 띄운 정수다. 새 할 일·옮긴 할 일은 이웃 사이 값 하나만 쓰고, 사이가 없을 때만
 * 그 사용자 할 일을 이 간격으로 다시 번호 매긴다
 */
export const TODO_SORT_ORDER_GAP = 1024;

// sortOrder 칸은 int4이고 응답 계약(int)과 맞추려 음수를 쓰지 않는다
const TODO_SORT_ORDER_MIN = 0;
const TODO_SORT_ORDER_MAX = 2_147_483_647;

// 양 끝을 뺀 사이 값. 사이에 정수가 없으면 null이다
function midpoint(lowerExclusive: number, upperExclusive: number): number | null {
  const span = upperExclusive - lowerExclusive;
  return span >= 2 ? lowerExclusive + Math.floor(span / 2) : null;
}

function sortOrderBelow(first: number): number | null {
  const stepped = first - TODO_SORT_ORDER_GAP;
  return TODO_SORT_ORDER_MIN <= stepped ? stepped : midpoint(TODO_SORT_ORDER_MIN - 1, first);
}

function sortOrderAbove(last: number): number | null {
  const stepped = last + TODO_SORT_ORDER_GAP;
  return stepped <= TODO_SORT_ORDER_MAX ? stepped : midpoint(last, TODO_SORT_ORDER_MAX + 1);
}

/**
 * 앞 할 일(before)과 뒤 할 일(after) 사이에 둘 sortOrder. 한쪽이 없으면 그 끝으로 한 간격 밖이다.
 * 사이에 정수가 없으면 null이고, 호출자가 다시 번호를 매긴 뒤 다시 계산한다
 */
export function sortOrderBetween(before: number | null, after: number | null): number | null {
  if (before == null) {
    return after == null ? TODO_SORT_ORDER_GAP : sortOrderBelow(after);
  }
  if (after == null) {
    return sortOrderAbove(before);
  }
  return midpoint(before, after);
}

/**
 * 맨 끝에 붙일 sortOrder. lastSortOrder는 지금 가장 큰 값이고 없으면 -1이라 첫 할 일은 한 간격에서 시작한다.
 * int4 끝에 닿으면 마지막 값을 다시 써 id 순서로 뒤에 둔다(간격으로 약 200만 개 뒤에야 닿는다)
 */
export function sortOrderAfterLast(lastSortOrder: number): number {
  if (lastSortOrder < TODO_SORT_ORDER_MIN) {
    return TODO_SORT_ORDER_GAP;
  }
  return sortOrderAbove(lastSortOrder) ?? lastSortOrder;
}

/** 맨 끝에 차례로 붙일 sortOrder count개 */
export function appendSortOrders(lastSortOrder: number, count: number): number[] {
  const sortOrders: number[] = [];
  let previous = lastSortOrder;
  for (let index = 0; index < count; index++) {
    previous = sortOrderAfterLast(previous);
    sortOrders.push(previous);
  }
  return sortOrders;
}
