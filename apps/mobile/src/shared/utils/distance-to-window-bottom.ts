interface ViewFrameInWindow {
  top: number;
  height: number;
}

/** 뷰 아래쪽 끝에서 창 아래쪽 끝까지의 거리. 하단 탭 바처럼 뷰와 키보드 사이에 낀 영역의 높이다. */
export function getDistanceToWindowBottom(windowHeight: number, viewFrame: ViewFrameInWindow) {
  return Math.max(windowHeight - (viewFrame.top + viewFrame.height), 0);
}
