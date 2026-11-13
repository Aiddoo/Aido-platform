import type { AppWindow, PaneAreaSize } from '@src/shared/ui/adaptive-pane/window-layout';

export function createAppWindow(overrides: Partial<AppWindow> = {}): AppWindow {
  return { width: 412, height: 915, os: 'android', isDesktop: false, ...overrides };
}

export function createPaneArea(overrides: Partial<PaneAreaSize> = {}): PaneAreaSize {
  return {
    width: 1000,
    leadingInset: 0,
    trailingInset: 0,
    insetsOccupyPane: true,
    foldX: null,
    ...overrides,
  };
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
  /** Surface Duo 한 화면 */
  duoSingleScreen: { width: 540, height: 720 },
  /** Surface Duo 두 화면에 걸쳐 편 앱(가운데 힌지 34 포함) */
  duoSpanned: { width: 1114, height: 720 },
  /** Pixel 9 위아래 분할 화면의 한쪽 창 */
  phoneSplitScreenHalf: { width: 412, height: 440 },
  /** iPad Air 11인치 세로 */
  iPadPortrait: { width: 820, height: 1180 },
  /** iPad Air 11인치 가로 */
  iPadLandscape: { width: 1180, height: 820 },
  /** iPad Pro 13인치 가로를 반으로 나눈 Split View */
  iPadHalfSplitView: { width: 683, height: 1024 },
  /** iPhone SE 3세대 */
  iPhoneSe: { width: 375, height: 667 },
  /** iPhone 13 mini */
  iPhoneMini: { width: 375, height: 812 },
  /** 접은 iPhone Duo 바깥 화면(기기에서 잰 창) */
  iPhoneDuoFolded: { width: 466, height: 678 },
} as const;

/** iPadOS 탭 사이드바 폭(pt). iPad Pro 13인치 iPadOS 27 시뮬레이터에서 잰 왼쪽 inset이다 */
export const IPAD_SIDEBAR_WIDTH = 280;

/** iPhone Duo 세로 레일 inset(pt) */
export const IPHONE_DUO_RAIL_WIDTH = 84;
