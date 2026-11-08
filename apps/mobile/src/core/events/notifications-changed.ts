import { createEventChannel } from './event-channel';

const channel = createEventChannel('notifications-changed');

/**
 * 서버의 알림 목록이 바뀌었을 수 있다는 단방향 채널.
 * 콕·차단처럼 알림함 아래층 기능이 위층인 알림을 import하지 않고 알린다.
 */
export function subscribeNotificationsChanged(listener: () => void): () => void {
  return channel.subscribe(listener);
}

export function emitNotificationsChanged(): void {
  channel.emit();
}
