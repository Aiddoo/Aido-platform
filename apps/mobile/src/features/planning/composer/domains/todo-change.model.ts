import type { TodoUpdateChanges } from '../schemas/todo-change-request.schema';

export function hasTodoUpdateChanges({ input, repeat }: TodoUpdateChanges): boolean {
  // oxlint-disable-next-line aido/no-strict-nullish -- repeat null은 반복 끝내기라 변경이다
  return Object.keys(input).length > 0 || repeat !== undefined;
}

// 날짜 이동은 범위와 상관없이 이 회차에만 적용되므로 범위를 묻지 않는다
export function hasOnlyDateChanges({ input, repeat }: TodoUpdateChanges): boolean {
  // oxlint-disable-next-line aido/no-strict-nullish -- repeat null도 날짜 밖의 변경이다
  if (repeat !== undefined) {
    return false;
  }
  const fields = Object.keys(input);
  return fields.length > 0 && fields.every((field) => field === 'startDate' || field === 'endDate');
}

export const TodoChangePolicy = { hasTodoUpdateChanges, hasOnlyDateChanges } as const;
