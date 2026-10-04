import { createExpoWidgetsBridge } from './expo-widgets.bridge';
import type { WidgetBridge } from './widget-bridge';

export function createWidgetBridge(): WidgetBridge {
  return createExpoWidgetsBridge();
}
