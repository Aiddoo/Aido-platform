import type { WidgetBridge } from '@src/features/device/widget/services/widget-sync.service';

import { mockMethod } from '../mock-method';

/** 위젯에 쓰기가 늘 성공하는 기기. 쓰기 실패는 반환된 함수를 테스트에서 바꾼다 */
export function createWidgetBridgeStub(): jest.Mocked<WidgetBridge> {
  return {
    writeSnapshot: mockMethod<WidgetBridge['writeSnapshot']>(async () => {}),
  };
}
