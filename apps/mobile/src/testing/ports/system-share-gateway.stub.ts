import type { SystemShareGateway } from '@src/core/ports/system-share-gateway';

import { mockMethod } from '../mock-method';

/** 공유 시트가 열리고 이미지 공유도 되는 기기가 기본값이다 */
export function createSystemShareGatewayStub(): jest.Mocked<SystemShareGateway> {
  return {
    share: mockMethod<SystemShareGateway['share']>(async () => true),
    isImageShareAvailable: jest.fn(async () => true),
    shareImage: mockMethod<SystemShareGateway['shareImage']>(async () => {}),
  };
}
