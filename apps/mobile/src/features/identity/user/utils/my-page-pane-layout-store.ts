/** 내 정보 탭과 메뉴 화면이 왼쪽 메뉴를 따로 그려서 들어가고 나올 때 메뉴가 움직이지 않게 스크롤을 나눠 갖는다 */
export function createMyPagePaneLayoutStore() {
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
    setScrollOffset: (next: number) => {
      scrollOffset = next;
    },
  };
}
