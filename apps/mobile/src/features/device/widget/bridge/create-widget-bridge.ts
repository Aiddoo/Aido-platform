import { createNoopWidgetBridge } from './noop-widget.bridge';
import type { WidgetBridge } from './widget-bridge';

export function createWidgetBridge(): WidgetBridge {
  return createNoopWidgetBridge();
}
