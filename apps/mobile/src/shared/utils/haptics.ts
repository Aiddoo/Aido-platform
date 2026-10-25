import { noop } from 'es-toolkit';
import * as Haptics from 'expo-haptics';

export function notifySuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(noop);
}

export function notifyError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(noop);
}

export function selectionFeedback() {
  Haptics.selectionAsync().catch(noop);
}

export function impactFeedback(style: Haptics.ImpactFeedbackStyle) {
  Haptics.impactAsync(style).catch(noop);
}
