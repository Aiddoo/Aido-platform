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
  for (const listener of Array.from(listeners)) {
    try {
      listener();
    } catch {
      // 한 리스너의 실패가 다른 리스너 알림을 막으면 안 됨
    }
  }
}
