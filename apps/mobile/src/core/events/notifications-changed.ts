import { createEventChannel } from './event-channel';

const channel = createEventChannel('notifications-changed');

/** 콕·차단처럼 알림함 아래층 기능이 위층인 알림을 import하지 않고 알린다 */
export function subscribeNotificationsChanged(listener: () => void): () => void {
  return channel.subscribe(listener);
}

export function emitNotificationsChanged(): void {
  channel.emit();
}
