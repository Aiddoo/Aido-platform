export type PurchaseStore = 'APP_STORE' | 'PLAY_STORE' | 'PROMOTIONAL' | 'OTHER';

interface PurchaseEntitlement {
  store: PurchaseStore;
  productIdentifier: string;
}

export interface PurchaseStatus {
  activeEntitlements: readonly PurchaseEntitlement[];
}

export type PurchasePackageType = 'MONTHLY' | 'ANNUAL' | 'OTHER';

export interface PurchasePackage {
  identifier: string;
  packageType: PurchasePackageType;
  product: {
    priceString: string;
    price: number;
    currencyCode: string;
    title: string;
    description: string | null;
  };
}

export interface PurchaseOffering {
  identifier: string;
  packages: readonly PurchasePackage[];
}

/** 어댑터 교체와 외부 재사용을 위해 열어 둔 포트 타입 @public */
export type PurchasePackageResult =
  | { type: 'purchased'; status: PurchaseStatus }
  | { type: 'package-not-found' };

/**
 * - `network`: 기기 연결 때문에 스토어에 닿지 못했다
 * - `store-setup`: 앱·스토어 설정이 맞지 않아 다시 해도 같다
 * - `store-problem`: 스토어가 잠시 응답하지 못했다
 */
export type PurchaseFailureKind =
  | 'network'
  | 'cancelled'
  | 'payment-pending'
  | 'store-setup'
  | 'store-problem'
  | 'other';

/** 스토어 SDK 오류를 SDK 코드 없이 넘긴다. 원래 코드는 문의·진단에만 쓴다 */
export class PurchasesGatewayError extends Error {
  override readonly name = 'PurchasesGatewayError';

  constructor(
    readonly kind: PurchaseFailureKind,
    readonly storeErrorCode: string | null,
    message: string,
  ) {
    super(message);
  }
}

/** `missing-api-key`: 이 빌드에는 결제 키가 없어 초기화하지 않았다 */
/** 어댑터 교체와 외부 재사용을 위해 열어 둔 포트 타입 @public */
export type PurchasesConfigureResult = 'configured' | 'missing-api-key';

export interface PurchasesGateway {
  /** 초기화에 실패하면 throw한다 */
  configure(): PurchasesConfigureResult;
  logIn(userId: string): Promise<void>;
  /** 로그인하지 않은 상태면 아무것도 하지 않는다 */
  logOut(): Promise<void>;
  setAttributes(attributes: Record<string, string | null>): Promise<void>;
  setAnalyticsId(analyticsId: string): Promise<void>;
  /** 판매 중인 요금제. 없으면 null. 실패하면 `PurchasesGatewayError`를 throw한다 */
  getOffering(): Promise<PurchaseOffering | null>;
  /** 실패하면 `PurchasesGatewayError`를 throw한다 */
  purchase(packageIdentifier: string): Promise<PurchasePackageResult>;
  /** 실패하면 `PurchasesGatewayError`를 throw한다 */
  restore(): Promise<PurchaseStatus>;
  getStatus(): Promise<PurchaseStatus>;
  subscribe(listener: (info: PurchaseStatus) => void): () => void;
}
