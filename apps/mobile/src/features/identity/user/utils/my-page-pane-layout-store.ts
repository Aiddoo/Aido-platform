// 탭과 메뉴 화면이 메뉴를 따로 그려, 이동 시 메뉴가 움직이지 않도록 스크롤과 위 여백을 나눠 갖는다
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
