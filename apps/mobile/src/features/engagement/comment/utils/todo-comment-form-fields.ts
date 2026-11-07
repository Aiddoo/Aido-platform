import type { TodoCommentFormValues } from '../schemas/todo-comment-form.schema';

export function getFocusedCommentFieldIndexAfterRemoval(
  focusedIndex: number,
  removedIndex: number,
): number {
  if (focusedIndex < removedIndex) {
    return focusedIndex;
  }

  if (focusedIndex > removedIndex) {
    return focusedIndex - 1;
  }

  return Math.max(0, removedIndex - 1);
}

/** 입력 칸에 글자가 하나도 없다. 공백만 있어도 비었다고 본다 */
export function isComposerBlank({ items }: Pick<TodoCommentFormValues, 'items'>) {
  return items.every((item) => item.content.trim().length === 0);
}

/** 보낼 글은 앞뒤 공백을 지운 값이다. 칸이 하나도 없으면 null */
export function getTrimmedContents(
  items: TodoCommentFormValues['items'],
): [string, ...string[]] | null {
  const [first, ...rest] = items.map((item) => item.content.trim());
  return first == null ? null : [first, ...rest];
}
