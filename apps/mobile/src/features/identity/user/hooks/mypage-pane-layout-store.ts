/**
 * 내 정보 탭과 메뉴 화면은 왼쪽 메뉴를 따로 그린다. 들어가고 나올 때 메뉴가 움직이지 않도록 스크롤과 위 여백을 나눠 갖는다.
 * 위 쪽 탭 바(iPad)는 탭 화면에만 있어 떠 있는 칸의 위 inset 중 큰 값을 쓴다. 칸마다 지금 값을 맡아 회전이나 접기로 줄면 함께 준다.
 * 기기에 남기지 않는 화면 임시 값이고, 메뉴 칸이 모두 사라지면(로그아웃) 비워 다음 로그인이 지난 스크롤에서 시작하지 않게 한다.
 */
export function createMyPagePaneLayoutStore() {
  const listeners = new Set<() => void>();
  const topInsets = new Map<string, number>();
  let scrollOffset = 0;
  let topInset = 0;

  function syncTopInset() {
    const next = Math.max(0, ...topInsets.values());
    if (next === topInset) {
      return;
    }
    topInset = next;
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          scrollOffset = 0;
          topInsets.clear();
          topInset = 0;
        }
      };
    },
    getTopInset: () => topInset,
    publishTopInset: (paneId: string, next: number) => {
      topInsets.set(paneId, next);
      syncTopInset();
    },
    removeTopInset: (paneId: string) => {
      topInsets.delete(paneId);
      syncTopInset();
    },
    getScrollOffset: () => scrollOffset,
    setScrollOffset: (next: number) => {
      scrollOffset = next;
    },
  };
}
