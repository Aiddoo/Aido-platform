import type { AppWindow } from '@src/shared/domains/window-layout.model';

export function createAppWindow(overrides: Partial<AppWindow> = {}): AppWindow {
  return { width: 412, height: 915, os: 'android', isDesktop: false, ...overrides };
}

/** 기기 창 크기(dp/pt). 제조사 해상도 ÷ 밀도로 어림한 값이다 */
export const DEVICE_WINDOW = {
  /** Pixel 9 */
  phone: { width: 412, height: 915 },
  /** Pixel 9 Pro Fold 바깥 화면 */
  foldedOuter: { width: 411, height: 923 },
  /** Galaxy Z Fold 바깥 화면. 폭이 가장 좁다 */
  narrowFoldedOuter: { width: 344, height: 882 },
  /** Pixel Fold 안쪽 화면(가로로 긴 펼침) */
  unfoldedInner: { width: 841, height: 701 },
  /** 10인치 Android 태블릿 */
  tablet: { width: 1280, height: 800 },
  /** iPad Air 11인치 세로 */
  iPadPortrait: { width: 820, height: 1180 },
  /** iPad Air 11인치 가로 */
  iPadLandscape: { width: 1180, height: 820 },
  /** iPad Pro 13인치 가로를 반으로 나눈 Split View */
  iPadHalfSplitView: { width: 683, height: 1024 },
} as const;

/** iPadOS 탭 사이드바 폭(pt)의 어림값. 열리면 탭 안 영역이 이만큼 좁아진다 */
export const IPAD_SIDEBAR_WIDTH = 320;
