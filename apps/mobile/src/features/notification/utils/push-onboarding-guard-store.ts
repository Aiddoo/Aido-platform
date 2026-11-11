/**
 * 앱 화면 묶음이 그린 알림 화면 guard 값. 화면마다 따로 판정하면 조회 알림이 닿는 순간이 달라 서로 어긋난다.
 * null은 내 정보·권한을 아직 몰라 열지 말지 정하지 못한 때다
 */
export function createPushOnboardingGuardStore() {
  const listeners = new Set<() => void>();
  let isOpen: boolean | null = null;

  return {
    get: () => isOpen,
    set: (next: boolean | null) => {
      if (next === isOpen) {
        return;
      }
      isOpen = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
