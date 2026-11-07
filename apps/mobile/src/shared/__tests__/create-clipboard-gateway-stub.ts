import type { ClipboardGateway } from '@src/core/ports/clipboard-gateway';

import { mockMethod } from './mock-method';

/** 클립보드가 비어 있는 기기가 기본값이다 */
export function createClipboardGatewayStub(): jest.Mocked<ClipboardGateway> {
  return {
    hasContent: jest.fn(async () => false),
    paste: jest.fn(async () => ''),
    copy: mockMethod<ClipboardGateway['copy']>(async () => {}),
  };
}
