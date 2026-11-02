import { toError } from '@src/shared/errors';
import { logger } from '@src/shared/infra/logger/global-logger';
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

import { createAccessibilitySettingStore } from './accessibility-setting-store';

const reduceTransparency = createAccessibilitySettingStore({
  read: () => AccessibilityInfo.isReduceTransparencyEnabled(),
  listen: (onChange) => {
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', onChange);
    return () => subscription.remove();
  },
  onReadError: (error) => {
    logger.warn('accessibility.reduce-transparency-read.failed', {
      error: toError(error).message,
    });
  },
});

/** 투명도 줄이기 설정(iOS). 첫 값은 비동기로만 읽을 수 있어 읽기 전에는 꺼진 것으로 본다. */
export function useReduceTransparency(): boolean {
  return (
    useSyncExternalStore(reduceTransparency.subscribe, reduceTransparency.getSnapshot) ?? false
  );
}
