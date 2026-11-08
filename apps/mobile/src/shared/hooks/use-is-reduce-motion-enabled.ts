import { getErrorMessage } from '@src/shared/errors';
import { logger } from '@src/shared/infra/logger/global-logger';
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { createAccessibilitySettingStore } from '../stores/accessibility-setting-store';
import { ACCESSIBILITY_LOG_EVENT } from './accessibility-log-events';

const reduceMotion = createAccessibilitySettingStore({
  read: () => AccessibilityInfo.isReduceMotionEnabled(),
  listen: (onChange) => {
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', onChange);
    return () => subscription.remove();
  },
  onReadError: (error) => {
    logger.warn(ACCESSIBILITY_LOG_EVENT.REDUCE_MOTION_READ_FAILED, {
      error: getErrorMessage(error),
    });
  },
});

/** Reanimated의 useReducedMotion은 앱 시작 때 값만 줘서 설정 변경을 따로 구독한다 */
export function useIsReduceMotionEnabled(): boolean {
  const isReducedAtLaunch = useReducedMotion();
  return (
    useSyncExternalStore(reduceMotion.subscribe, reduceMotion.getSnapshot) ?? isReducedAtLaunch
  );
}
