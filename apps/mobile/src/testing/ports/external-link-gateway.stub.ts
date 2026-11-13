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

export interface IncomingLinkGatewayStub extends jest.Mocked<IncomingLinkGateway> {
  /** 앱이 켜진 채 링크가 들어온 것처럼 알린다 */
  emit(url: string): void;
  /** 남은 구독 수. 내린 앱이 구독을 남겼는지 본다 */
  getListenerCount(): number;
}

/** 링크 없이 켠 앱이 기본값이다 */
export function createIncomingLinkGatewayStub(): IncomingLinkGatewayStub {
  const listeners = new Set<(url: string) => void>();

  return {
    getInitialUrl: mockMethod<IncomingLinkGateway['getInitialUrl']>(async () => null),
    subscribe: mockMethod<IncomingLinkGateway['subscribe']>((listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
    emit: (url) => {
      for (const listener of Array.from(listeners)) {
        listener(url);
      }
    },
    getListenerCount: () => listeners.size,
  };
}
