import { createEventChannel } from './event-channel';

const channel = createEventChannel('todo-created');

/** 할 일을 만드는 기능(작성, 메모 변환, 말로 계획, 제안 수락)이 위층(활성화 체크리스트)을 import하지 않고 알린다 */
export function subscribeTodoCreated(listener: () => void): () => void {
  return channel.subscribe(listener);
}

export function emitTodoCreated(): void {
  channel.emit();
}
