import { getErrorMessage } from '@src/shared/errors';
import { logger } from '@src/shared/infra/logger/global-logger';
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { ACCESSIBILITY_LOG_EVENT } from './accessibility-log-events';
import { createAccessibilitySettingStore } from './accessibility-setting-store';

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

/**
 * 동작 줄이기 설정. Reanimated의 useReducedMotion은 앱 시작 때 값만 주므로,
 * 첫 그림은 그 값으로 그리고 앱을 켠 채 설정을 바꾸면 다시 그린다.
 */
export function useReduceMotion(): boolean {
  const isReducedAtLaunch = useReducedMotion();
  return (
    useSyncExternalStore(reduceMotion.subscribe, reduceMotion.getSnapshot) ?? isReducedAtLaunch
  );
}
