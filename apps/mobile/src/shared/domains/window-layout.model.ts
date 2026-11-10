import { getWindowSizeClass, type WindowSizeClass } from '@src/shared/utils/get-window-size-class';
import { z } from 'zod';

/** 앱 창. 크기는 `useWindowDimensions`의 dp(iOS pt)다 */
const appWindowSchema = z.object({
  width: z.number(),
  height: z.number(),
  os: z.enum(['ios', 'android']),
  /** Mac(Designed for iPad)에서 도는 창 */
  isDesktop: z.boolean(),
});

export type AppWindow = z.infer<typeof appWindowSchema>;

/** 목록·상세 칸을 나눌 영역. iPad 탭 사이드바가 열리면 창보다 좁다 */
const paneAreaSchema = z.object({
  /** 영역이 잰 폭. 재기 전이면 null */
  width: z.number().nullable(),
  /** 반쯤 접은 자세의 세로 접힘선 x(영역 좌표). 없으면 null */
  foldX: z.number().nullable(),
});

type PaneAreaSize = z.infer<typeof paneAreaSchema>;

export interface PaneColumns {
  isSplit: boolean;
  /** 목록 칸 폭. 한 칸이면 영역 전체다 */
  primaryWidth: number;
}

type OrientationLock = 'portrait' | 'unlocked';

/** 목록 칸의 최소 폭. 상세 칸이 남은 폭을 채운다 */
const PRIMARY_PANE_WIDTH = { medium: 320, expanded: 400 } as const;

/** Mac은 창 폭과 관계없이 모바일과 같은 경험을 주는 제품 결정이다 */
function getSizeClass(window: AppWindow): WindowSizeClass {
  return window.isDesktop ? 'compact' : getWindowSizeClass(window.width);
}

/** 창 폭이 아니라 영역 폭으로 나눠야 사이드바가 칸을 짓누르지 않는다. 재기 전에는 창 폭으로 어림한다 */
function getPaneSizeClass(window: AppWindow, areaWidth: number | null): WindowSizeClass {
  return getSizeClass({ ...window, width: areaWidth ?? window.width });
}

/** 접힘선이 있으면 목록을 접힘선 앞면에 맞춘다 */
function getPaneColumns(window: AppWindow, area: PaneAreaSize): PaneColumns {
  const sizeClass = getPaneSizeClass(window, area.width);

  if (sizeClass === 'compact') {
    return { isSplit: false, primaryWidth: area.width ?? window.width };
  }
  return { isSplit: true, primaryWidth: area.foldX ?? PRIMARY_PANE_WIDTH[sizeClass] };
}

/**
 * 짧은 변(Android smallest width)으로 재야 가로로 든 휴대폰이 넓은 창으로 풀리지 않고, 돌려도 결정이 바뀌지 않는다.
 * Android 16+은 짧은 변 600dp 이상 화면에서 앱의 방향 고정을 무시하므로 같은 기준으로 그 아래만 묶는다.
 * iOS는 Info.plist(iPhone 세로, iPad 네 방향)가 정해 앱이 실행 중에 바꾸지 않는다(null).
 */
function getOrientationLock(window: AppWindow): OrientationLock | null {
  if (window.os === 'ios') {
    return null;
  }
  const smallestWidth = Math.min(window.width, window.height);

  return getWindowSizeClass(smallestWidth) === 'compact' ? 'portrait' : 'unlocked';
}

export const WindowLayoutPolicy = {
  getSizeClass,
  getPaneSizeClass,
  getPaneColumns,
  getOrientationLock,
} as const;
