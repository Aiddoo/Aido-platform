import type { PurchaseStatus, PurchasesGateway } from '@src/core/ports/purchases-gateway';

import { mockMethod } from './mock-method';

const NO_SUBSCRIPTION: PurchaseStatus = { activeEntitlements: [] };

export interface PurchasesGatewayStub extends jest.Mocked<PurchasesGateway> {
  /** 스토어가 고객 정보를 바꾼 것처럼 구독자에게 알린다 */
  emitCustomerInfo(info: PurchaseStatus): void;
  getListenerCount(): number;
}

/** 구독이 없는 스토어 계정. 판매 중인 요금제는 없고 어떤 패키지도 찾을 수 없다. 요금제는 테스트가 정한다 */
export function createPurchasesGatewayStub(): PurchasesGatewayStub {
  const listeners = new Set<(info: PurchaseStatus) => void>();

  return {
    configure: jest.fn(),
    logIn: mockMethod<PurchasesGateway['logIn']>(async () => {}),
    logOut: jest.fn(async () => {}),
    setAttributes: mockMethod<PurchasesGateway['setAttributes']>(async () => {}),
    setAnalyticsId: mockMethod<PurchasesGateway['setAnalyticsId']>(async () => {}),
    getOffering: jest.fn(async () => null),
    purchase: mockMethod<PurchasesGateway['purchase']>(async () => ({ type: 'package-not-found' })),
    restore: jest.fn(async () => NO_SUBSCRIPTION),
    getStatus: jest.fn(async () => NO_SUBSCRIPTION),
    subscribe: mockMethod<PurchasesGateway['subscribe']>((listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
    emitCustomerInfo: (info) => {
      for (const listener of listeners) {
        listener(info);
      }
    },
    getListenerCount: () => listeners.size,
  };
}
