import { Platform } from 'react-native';

import type { WidgetSnapshotRepository } from '../repositories/widget-snapshot.repository';
import { createAndroidWidgetBridge } from './android-widget.bridge';
import { createExpoWidgetsBridge } from './expo-widgets.bridge';
import { createNoopWidgetBridge } from './noop-widget.bridge';
import type { WidgetBridge } from './widget-bridge';

/** 플랫폼별 위젯 브리지 팩토리 (두 라이브러리 모두 타 플랫폼에서 no-op 스텁으로 임포트 안전) */
export function createWidgetBridge(repository: WidgetSnapshotRepository): WidgetBridge {
  if (Platform.OS === 'ios') {
    return createExpoWidgetsBridge();
  }
  if (Platform.OS === 'android') {
    return createAndroidWidgetBridge(repository);
  }
  return createNoopWidgetBridge();
}
