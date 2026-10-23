import type { PlatformOSType } from 'react-native';

export const TOAST_MIN_TOP_GAP = 12;

/**
 * HeroUI Native는 iOS에서 위쪽 safe area만큼만 띄운다. 접은 iPhone Duo처럼 상태 표시가
 * 세로 레일로 옮겨 위쪽 inset이 0이면 토스트가 화면 모서리에 붙으므로 최소 간격을 둔다.
 * `undefined`는 HeroUI 기본값을 그대로 쓴다는 뜻이다.
 */
export function getToastTopInset(safeAreaTop: number, os: PlatformOSType): number | undefined {
  if (os !== 'ios' || safeAreaTop > 0) {
    return undefined;
  }

  return TOAST_MIN_TOP_GAP;
}
