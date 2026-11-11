import type { ClipboardGateway } from '@src/core/ports/clipboard-gateway';

import { mockMethod } from '../mock-method';

export function createClipboardGatewayStub(): jest.Mocked<ClipboardGateway> {
  return {
    copy: mockMethod<ClipboardGateway['copy']>(async () => {}),
  };
}
