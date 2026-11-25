import { createWidgetBridge } from '@src/features/device/widget/bridge/create-widget-bridge';

/**
 * 운영 조립(`create-device-ports`)이 넣는 플랫폼 위젯 브리지. `create-device-ports`는 Jest에서 읽지 못하는 SDK를 함께 불러
 * 위젯 저장 계약 테스트가 이것으로 실제 네이티브 쓰기(iOS timeline·Android 저장소)를 본다
 */
export function createDeviceWidgetBridge() {
  return createWidgetBridge();
}
