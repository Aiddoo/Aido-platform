interface TodoCompletionChange {
  isCompleted: boolean;
}

const listeners = new Set<(change: TodoCompletionChange) => void>();

/**
 * 서버가 할 일 완료 변경을 받았다는 단방향 채널.
 * 활성화 체크리스트처럼 할 일 위층 기능이 기기 기록을 남기도록, 할 일이 위층을 import하지 않고 알린다.
 */
export function subscribeTodoCompletionChanged(
  listener: (change: TodoCompletionChange) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitTodoCompletionChanged(change: TodoCompletionChange): void {
  for (const listener of Array.from(listeners)) {
    listener(change);
  }
}
