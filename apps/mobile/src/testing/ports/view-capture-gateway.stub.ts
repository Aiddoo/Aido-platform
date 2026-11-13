import type { ViewCaptureGateway } from '@src/core/ports/view-capture-gateway';

import { mockMethod } from '../mock-method';

/** 항상 파일 하나를 찍은 것으로 답한다. 못 찍는 경우는 테스트가 `capture`를 바꾼다 */
export function createViewCaptureGatewayStub(): jest.Mocked<ViewCaptureGateway> {
  return {
    capture: mockMethod<ViewCaptureGateway['capture']>(async () => 'file:///view-capture.png'),
  };
}
