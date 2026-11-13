import { createEventChannel } from './event-channel';

const channel = createEventChannel('session-confirmed');

/** 서버가 이 세션의 인증 요청에 성공으로 답했다. 인프라는 DI를 모르므로 세션 정리에 모듈 옵저버로 알린다 */
export function subscribeSessionConfirmed(listener: () => void): () => void {
  return channel.subscribe(listener);
}

export function emitSessionConfirmed(): void {
  channel.emit();
}
