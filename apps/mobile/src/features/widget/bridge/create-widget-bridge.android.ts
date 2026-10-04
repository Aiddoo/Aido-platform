import { createAndroidWidgetsBridge } from './android-widgets.bridge';
import type { WidgetBridge } from './widget-bridge';

export function createWidgetBridge(): WidgetBridge {
  return createAndroidWidgetsBridge();
}
