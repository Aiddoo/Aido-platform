import type { AppIconGateway } from '@src/core/ports/app-icon-gateway';

import { mockMethod } from '../mock-method';

/** 기본은 지원하는 기기에서 기본 아이콘을 쓰는 상태다. 바꾸면 요청한 이름을 그대로 돌려준다 */
export function createAppIconGatewayStub(): jest.Mocked<AppIconGateway> {
  return {
    isAvailable: jest.fn(() => true),
    getCurrentIcon: jest.fn(async () => null),
    changeIcon: mockMethod<AppIconGateway['changeIcon']>(async (name) => name),
  };
}
