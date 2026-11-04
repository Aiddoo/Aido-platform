import type { HapticImpact, HapticNotification, HapticsGateway } from '@src/core/ports/haptics';
import { noop } from 'es-toolkit';
import * as Haptics from 'expo-haptics';

const IMPACT_STYLE = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
} as const satisfies Record<HapticImpact, Haptics.ImpactFeedbackStyle>;

const NOTIFICATION_TYPE = {
  success: Haptics.NotificationFeedbackType.Success,
  error: Haptics.NotificationFeedbackType.Error,
  warning: Haptics.NotificationFeedbackType.Warning,
} as const satisfies Record<HapticNotification, Haptics.NotificationFeedbackType>;

export const expoHapticsGateway: HapticsGateway = {
  selection: () => {
    Haptics.selectionAsync().catch(noop);
  },
  impact: (style) => {
    Haptics.impactAsync(IMPACT_STYLE[style]).catch(noop);
  },
  notify: (type) => {
    Haptics.notificationAsync(NOTIFICATION_TYPE[type]).catch(noop);
  },
};
