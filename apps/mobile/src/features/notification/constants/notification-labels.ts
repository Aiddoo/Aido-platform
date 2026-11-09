import type { PushSummary } from '../utils/push-permission.view-model';

export const PUSH_SUMMARY_LABEL_KEYS = {
  on: 'settings.on',
  off: 'settings.off',
  deviceOff: 'settings.deviceOff',
} as const satisfies Record<PushSummary, string>;
