import { getErrorMessage } from '@src/shared/errors';
import { logger } from '@src/shared/infra/logger/global-logger';
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

import { createAccessibilitySettingStore } from '../stores/accessibility-setting-store';
import { ACCESSIBILITY_LOG_EVENT } from './accessibility-log-events';

const reduceTransparency = createAccessibilitySettingStore({
  read: () => AccessibilityInfo.isReduceTransparencyEnabled(),
  listen: (onChange) => {
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', onChange);
    return () => subscription.remove();
  },
  onReadError: (error) => {
    logger.warn(ACCESSIBILITY_LOG_EVENT.REDUCE_TRANSPARENCY_READ_FAILED, {
      error: getErrorMessage(error),
    });
  },
});

/** 투명도 줄이기 설정(iOS). 첫 값은 비동기로만 읽을 수 있어 읽기 전에는 꺼진 것으로 본다. */
export function useIsReduceTransparencyEnabled(): boolean {
  return (
    useSyncExternalStore(reduceTransparency.subscribe, reduceTransparency.getSnapshot) ?? false
  );
}
