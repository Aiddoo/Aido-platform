const listeners = new Set<() => void>();

/**
 * 서버의 알림 목록이 바뀌었을 수 있다는 단방향 채널.
 * 콕·차단처럼 알림함 아래층 기능이 위층인 알림을 import하지 않고 알린다.
 */
export function subscribeNotificationsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitNotificationsChanged(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}
