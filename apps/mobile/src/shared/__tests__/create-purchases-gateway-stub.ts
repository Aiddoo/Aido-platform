import type {
  PurchaseStatus,
  PurchaseOffering,
  PurchasePackageResult,
  PurchasesGateway,
} from '@src/core/ports/purchases';

const NO_SUBSCRIPTION: PurchaseStatus = { activeEntitlements: [] };

export interface PurchasesGatewayStub extends jest.Mocked<PurchasesGateway> {
  /** 스토어가 고객 정보를 바꾼 것처럼 구독자에게 알린다 */
  emitCustomerInfo(info: PurchaseStatus): void;
  getListenerCount(): number;
}

/** 구독이 없는 스토어 계정. 판매 중인 요금제는 테스트가 정한다 */
export function createPurchasesGatewayStub(): PurchasesGatewayStub {
  const listeners = new Set<(info: PurchaseStatus) => void>();

  return {
    configure: jest.fn(),
    logIn: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
    logOut: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    setAttributes: jest
      .fn<Promise<void>, Parameters<PurchasesGateway['setAttributes']>>()
      .mockResolvedValue(undefined),
    setAnalyticsId: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
    getOffering: jest.fn<Promise<PurchaseOffering | null>, []>().mockResolvedValue(null),
    purchase: jest
      .fn<Promise<PurchasePackageResult>, [string]>()
      .mockResolvedValue({ type: 'package-not-found' }),
    restore: jest.fn<Promise<PurchaseStatus>, []>().mockResolvedValue(NO_SUBSCRIPTION),
    getStatus: jest.fn<Promise<PurchaseStatus>, []>().mockResolvedValue(NO_SUBSCRIPTION),
    subscribe: jest.fn((listener: (info: PurchaseStatus) => void) => {
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
