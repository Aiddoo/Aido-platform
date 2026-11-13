export interface MyPagePaneLayoutStore {
  /** 메뉴 칸이 붙을 때 부르고, 돌려준 함수로 뗀다 */
  attach(): () => void;
  getScrollOffset(): number;
  setScrollOffset(next: number): void;
}

/**
 * 메뉴를 그리는 곳(좁은 화면 마이 탭 첫 화면, 넓은 화면 화면마다 왼쪽 칸)이 바뀌어도 같은 스크롤에서 시작하게 위치를 넘겨받는다.
 * DI가 소유해 컨테이너를 새로 만들면(루트 다시 시도) 지난 위치가 남지 않는다
 */
export function createMyPagePaneLayoutStore(): MyPagePaneLayoutStore {
  let paneCount = 0;
  let scrollOffset = 0;

  return {
    attach: () => {
      paneCount += 1;

      return () => {
        paneCount -= 1;
        // 로그아웃으로 칸이 모두 사라지면 비워 다음 로그인이 지난 스크롤에서 시작하지 않게 한다
        if (paneCount === 0) {
          scrollOffset = 0;
        }
      };
    },
    getScrollOffset: () => scrollOffset,
    setScrollOffset: (next) => {
      scrollOffset = next;
    },
  };
}
