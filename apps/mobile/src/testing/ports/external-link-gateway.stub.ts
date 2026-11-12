import type { ExternalLinkGateway } from '@src/core/ports/external-link-gateway';
import type { IncomingLinkGateway } from '@src/core/ports/incoming-link-gateway';

import { mockMethod } from '../mock-method';

/** 어떤 링크든 열리는 기기가 기본값이다 */
export function createExternalLinkGatewayStub(): jest.Mocked<ExternalLinkGateway> {
  return {
    open: mockMethod<ExternalLinkGateway['open']>(async () => {}),
    openInAppBrowser: mockMethod<ExternalLinkGateway['openInAppBrowser']>(async () => {}),
    openSettings: mockMethod<ExternalLinkGateway['openSettings']>(async () => {}),
  };
}

/** 링크 없이 켠 앱이 기본값이다. 새 링크는 들어오지 않는다 */
export function createIncomingLinkGatewayStub(): jest.Mocked<IncomingLinkGateway> {
  return {
    getInitialUrl: mockMethod<IncomingLinkGateway['getInitialUrl']>(async () => null),
    subscribe: mockMethod<IncomingLinkGateway['subscribe']>(() => () => {}),
  };
}
