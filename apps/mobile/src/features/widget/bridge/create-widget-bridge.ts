import { Platform } from 'react-native';

import { createExpoWidgetsBridge } from './expo-widgets.bridge';
import { createNoopWidgetBridge } from './noop-widget.bridge';
import type { WidgetBridge } from './widget-bridge';

export function createWidgetBridge(): WidgetBridge {
  return Platform.OS === 'ios' || Platform.OS === 'android'
    ? createExpoWidgetsBridge()
    : createNoopWidgetBridge();
}
