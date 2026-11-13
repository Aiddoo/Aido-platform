import { APP_PLATFORMS } from '@aido/api/vocabulary';
import { z } from 'zod';

/** Material window size class 기준 폭(dp). iOS size class는 폭 숫자로 정해지지 않아 iOS도 같은 숫자(pt)로 나눈다 */
const MEDIUM_WINDOW_MIN_WIDTH = 600;
const EXPANDED_WINDOW_MIN_WIDTH = 840;

export type WindowSizeClass = 'compact' | 'medium' | 'expanded';

function getWindowSizeClass(windowWidth: number): WindowSizeClass {
  if (windowWidth >= EXPANDED_WINDOW_MIN_WIDTH) {
    return 'expanded';
  }
  if (windowWidth >= MEDIUM_WINDOW_MIN_WIDTH) {
    return 'medium';
  }
  return 'compact';
}

/** 앱 창. 크기는 `useWindowDimensions`의 dp(iOS pt)다 */
const appWindowSchema = z.object({
  width: z.number(),
  height: z.number(),
  os: z.enum(APP_PLATFORMS),
  /** Mac(Designed for iPad)에서 도는 창 */
  isDesktop: z.boolean(),
});

export type AppWindow = z.infer<typeof appWindowSchema>;

/** 목록·상세 칸을 나눌 탭 안 영역. iPadOS 26+ 사이드바·iPhone Duo 레일은 영역 폭을 줄이지 않고 좌우 inset으로 온다 */
const paneAreaSchema = z.object({
  /** 영역 폭. `PaneArea` 밖이면 null이라 창 폭을 쓴다 */
  width: z.number().nullable(),
  /** 목록 칸이 닿는 가장자리(LTR 왼쪽)의 inset */
  leadingInset: z.number(),
  /** 상세 칸이 닿는 가장자리의 inset */
  trailingInset: z.number(),
  /** 좌우 inset이 칸 자리를 차지하는지. iPad 사이드바·iPhone Duo 레일은 차지하고, Android 시스템 바·컷아웃은 칸 안에서 피해 창 폭 그대로 나눈다 */
  insetsOccupyPane: z.boolean(),
  /** 반쯤 접은 자세의 세로 접힘선 x(영역 좌표). 없으면 null */
  foldX: z.number().nullable(),
});

export type PaneAreaSize = z.infer<typeof paneAreaSchema>;

export type PaneAreaMetrics = Omit<PaneAreaSize, 'foldX'>;

export interface PaneColumns {
  isSplit: boolean;
  /** 목록 칸 폭(닿는 가장자리 inset 포함). 한 칸이면 영역 전체다 */
  primaryWidth: number;
}

type OrientationLock = 'portrait' | 'unlocked';

/** 목록 칸의 최소 폭. 상세 칸이 남은 폭을 채운다 */
const PRIMARY_PANE_WIDTH = { medium: 320, expanded: 400 } as const;

/** 이보다 낮은 창은 키보드를 올린 시트에 입력칸·두 줄 내용·주 버튼이 함께 들어가지 않는다. 접은 iPhone Duo(678)는 색 두 줄이 밀려났고 SE(667)도 같은 배치를 쓴다 */
const SHORT_WINDOW_HEIGHT = 720;

/** Mac은 창 폭과 관계없이 모바일과 같은 경험을 주는 제품 결정이다 */
function getSizeClass(window: AppWindow): WindowSizeClass {
  return window.isDesktop ? 'compact' : getWindowSizeClass(window.width);
}

/** 칸 자리를 차지하는 inset만 칸 폭 계산에 넣는다. 시스템 바·컷아웃 inset으로 크기 등급이 바뀌지 않는다 */
function getOccupiedInsets(area: PaneAreaMetrics): { leading: number; trailing: number } {
  if (!area.insetsOccupyPane) {
    return { leading: 0, trailing: 0 };
  }
  return { leading: area.leadingInset, trailing: area.trailingInset };
}

/** 사이드바·레일 inset을 뺀 내용 폭으로 나눠야 사이드바가 칸을 짓누르지 않는다 */
function getPaneSizeClass(window: AppWindow, area: PaneAreaMetrics): WindowSizeClass {
  const { leading, trailing } = getOccupiedInsets(area);
  const contentWidth = (area.width ?? window.width) - leading - trailing;

  return getSizeClass({ ...window, width: contentWidth });
}

/** 목록 칸은 닿는 가장자리의 사이드바·레일 inset을 바깥에 더해 내용 폭이 320/400이다. 접힘선이 있으면 목록을 접힘선 앞면에 맞춘다 */
function getPaneColumns(window: AppWindow, area: PaneAreaSize): PaneColumns {
  const sizeClass = getPaneSizeClass(window, area);

  if (sizeClass === 'compact') {
    return { isSplit: false, primaryWidth: area.width ?? window.width };
  }
  const listWidthWithInset = PRIMARY_PANE_WIDTH[sizeClass] + getOccupiedInsets(area).leading;

  return { isSplit: true, primaryWidth: area.foldX ?? listWidthWithInset };
}

/** 짧은 변(Android smallest width)으로 재 가로로 든 휴대폰이 넓은 창이 되지 않게 하고, Android 16+이 600dp 이상에서 방향 고정을 무시하는 기준과 맞춘다. iOS는 Info.plist가 정해 null이다 */
function getOrientationLock(window: AppWindow): OrientationLock | null {
  if (window.os === 'ios') {
    return null;
  }
  const smallestWidth = Math.min(window.width, window.height);

  return getWindowSizeClass(smallestWidth) === 'compact' ? 'portrait' : 'unlocked';
}

/** 시트 안 여러 줄 선택지를 가로 한 줄로 줄일 만큼 낮은 창 */
function isShortWindow(window: AppWindow): boolean {
  return window.height < SHORT_WINDOW_HEIGHT;
}

export const WindowLayoutPolicy = {
  getSizeClass,
  getPaneSizeClass,
  getPaneColumns,
  getOrientationLock,
  isShortWindow,
} as const;
