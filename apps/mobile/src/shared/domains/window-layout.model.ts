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

export type OrientationLock = 'portrait' | 'unlocked';

/** Mac은 창 폭과 관계없이 모바일과 같은 경험을 주는 제품 결정이다 */
function getSizeClass(window: AppWindow): WindowSizeClass {
  return window.isDesktop ? 'compact' : getWindowSizeClass(window.width);
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

export const WindowLayoutPolicy = { getSizeClass, getOrientationLock } as const;
