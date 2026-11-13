/** `pending`은 내 정보·권한을 아직 몰라 알림 화면을 열지 말지 정하지 못한 때다 */
export type PushOnboardingGuardState = 'open' | 'closed' | 'pending';

export interface PushOnboardingGuardStore {
  getSnapshot(): PushOnboardingGuardState;
  subscribe(listener: () => void): () => void;
  markRendered(state: PushOnboardingGuardState): void;
  clear(): void;
}

/**
 * 앱 화면 묶음이 그린 알림 화면 guard 값. 화면마다 따로 판정하면 조회 알림이 닿는 순간이 달라 서로 어긋난다.
 * DI가 소유해 컨테이너를 새로 만들면(루트 다시 시도) 이전 판정이 남지 않는다
 */
export function createPushOnboardingGuardStore(): PushOnboardingGuardStore {
  const listeners = new Set<() => void>();
  let state: PushOnboardingGuardState = 'pending';

  function setState(next: PushOnboardingGuardState) {
    if (next === state) {
      return;
    }
    state = next;
    for (const listener of Array.from(listeners)) {
      listener();
    }
  }

  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    markRendered: setState,
    clear: () => setState('pending'),
  };
}
