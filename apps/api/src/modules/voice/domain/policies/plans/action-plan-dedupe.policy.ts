export interface ExistingTodo {
  readonly id: number;
  readonly title: string;
  readonly startDate: string;
  readonly isRepeating: boolean;
}

/** 띄어쓰기·문장 부호·대소문자·전각 차이는 받아쓰기 잡음이라 같은 제목으로 본다. */
function normalizeTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

/**
 * 이미 있는 같은 할 일을 찾는다. AI가 고른 id(정규화에서 목록 안의 id만 남았다)를 먼저 믿고, 못 골랐으면
 * 제목이 같고 같은 날이거나 진행 중인 반복 할 일인 것을 고른다. 앱은 겹친 할 일을 기본으로 선택하지 않는다.
 */
export function findDuplicateTodoId(
  todo: {
    readonly title: string;
    readonly startDate: string;
    readonly duplicateOfTodoId: number | null;
  },
  existing: readonly ExistingTodo[],
): number | null {
  if (todo.duplicateOfTodoId != null) {
    return todo.duplicateOfTodoId;
  }
  const title = normalizeTitle(todo.title);
  const duplicate = existing.find(
    (candidate) =>
      normalizeTitle(candidate.title) === title &&
      (candidate.isRepeating || candidate.startDate === todo.startDate),
  );
  return duplicate?.id ?? null;
}
