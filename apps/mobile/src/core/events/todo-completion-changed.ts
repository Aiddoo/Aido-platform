import { createEventChannel } from './event-channel';

interface TodoCompletionChange {
  isCompleted: boolean;
}

const channel = createEventChannel<TodoCompletionChange>('todo-completion-changed');

/** 할 일이 위층(활성화 체크리스트)을 import하지 않고 알린다 */
export function subscribeTodoCompletionChanged(
  listener: (change: TodoCompletionChange) => void,
): () => void {
  return channel.subscribe(listener);
}

export function emitTodoCompletionChanged(change: TodoCompletionChange): void {
  channel.emit(change);
}
