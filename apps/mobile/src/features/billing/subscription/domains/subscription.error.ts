import {
  ApiError,
  BusinessError,
  NetworkError,
  ParseError,
  ServerError,
  TimeoutError,
} from '@src/shared/errors';
import { match, P } from 'ts-pattern';

export const SUBSCRIPTION_ERROR_CODE = {
  /** 스토어 SDK를 쓸 수 없다(키 없음·초기화 실패·스토어 설정 문제) */
  STORE_UNAVAILABLE: 'SUBSCRIPTION_STORE_UNAVAILABLE',
  /** 스토어가 잠시 응답하지 못했다. 설정 문제와 달리 나중에 다시 하면 풀릴 수 있다 */
  STORE_PROBLEM: 'SUBSCRIPTION_STORE_PROBLEM',
  /** 스토어에는 닿았지만 팔 수 있는 요금제를 받지 못했다 */
  OFFERINGS_UNAVAILABLE: 'SUBSCRIPTION_OFFERINGS_UNAVAILABLE',
  /** 기기 연결 때문에 스토어에 닿지 못했다 */
  NETWORK: 'SUBSCRIPTION_NETWORK',
  PURCHASE_CANCELLED: 'SUBSCRIPTION_PURCHASE_CANCELLED',
  PAYMENT_PENDING: 'SUBSCRIPTION_PAYMENT_PENDING',
  PURCHASE_FAILED: 'SUBSCRIPTION_PURCHASE_FAILED',
  RESTORE_FAILED: 'SUBSCRIPTION_RESTORE_FAILED',
} as const;

export type SubscriptionErrorCode =
  (typeof SUBSCRIPTION_ERROR_CODE)[keyof typeof SUBSCRIPTION_ERROR_CODE];

export class SubscriptionError extends BusinessError<SubscriptionErrorCode> {
  // Sentry breadcrumb 메시지가 오류 이름을 쓴다
  override readonly name: string = 'SubscriptionError';
  /** 스토어 SDK가 준 원래 오류 코드. 문의·진단에만 쓰고 화면 분기는 `code`로 한다 */
  readonly storeErrorCode: string | null;

  constructor(code: SubscriptionErrorCode, storeErrorCode: string | null = null) {
    super(code);
    this.storeErrorCode = storeErrorCode;
  }
}

export const SubscriptionErrors = {
  storeUnavailable: (storeErrorCode: string | null = null) =>
    new SubscriptionError(SUBSCRIPTION_ERROR_CODE.STORE_UNAVAILABLE, storeErrorCode),

  storeProblem: (storeErrorCode: string | null = null) =>
    new SubscriptionError(SUBSCRIPTION_ERROR_CODE.STORE_PROBLEM, storeErrorCode),

  offeringsUnavailable: (storeErrorCode: string | null = null) =>
    new SubscriptionError(SUBSCRIPTION_ERROR_CODE.OFFERINGS_UNAVAILABLE, storeErrorCode),

  network: (storeErrorCode: string | null = null) =>
    new SubscriptionError(SUBSCRIPTION_ERROR_CODE.NETWORK, storeErrorCode),

  purchaseCancelled: (storeErrorCode: string | null = null) =>
    new SubscriptionError(SUBSCRIPTION_ERROR_CODE.PURCHASE_CANCELLED, storeErrorCode),

  paymentPending: (storeErrorCode: string | null = null) =>
    new SubscriptionError(SUBSCRIPTION_ERROR_CODE.PAYMENT_PENDING, storeErrorCode),

  purchaseFailed: (storeErrorCode: string | null = null) =>
    new SubscriptionError(SUBSCRIPTION_ERROR_CODE.PURCHASE_FAILED, storeErrorCode),

  restoreFailed: (storeErrorCode: string | null = null) =>
    new SubscriptionError(SUBSCRIPTION_ERROR_CODE.RESTORE_FAILED, storeErrorCode),
} as const;

/** 메시지·사용자 정보 없이 원인을 찾을 만큼만 담는다. 스토어 SDK 코드가 있으면 괄호로 덧붙인다 */
export function getSubscriptionDiagnosticCode(error: unknown): string {
  return match(error)
    .with(P.instanceOf(SubscriptionError), ({ code, storeErrorCode }) =>
      storeErrorCode == null ? code : `${code} (${storeErrorCode})`,
    )
    .with(P.instanceOf(ApiError), ({ code }) => code)
    .with(P.instanceOf(NetworkError), () => 'NETWORK')
    .with(P.instanceOf(TimeoutError), () => 'TIMEOUT')
    .with(P.instanceOf(ServerError), ({ status }) => `SERVER_${status}`)
    .with(P.instanceOf(ParseError), () => 'INVALID_RESPONSE')
    .otherwise(() => 'UNKNOWN');
}

/** network는 연결을 확인하면, server는 잠시 뒤 다시 하면 풀린다. store는 스토어에 닿지 못했거나 팔 요금제가 없다 */
export type SubscriptionFailureCause =
  | 'network'
  | 'server'
  | 'store'
  | 'purchaseCancelled'
  | 'paymentPending'
  | 'purchaseFailed'
  | 'restoreFailed';

export function getSubscriptionFailureCause(error: unknown): SubscriptionFailureCause {
  return match(error)
    .returnType<SubscriptionFailureCause>()
    .with(P.instanceOf(SubscriptionError), ({ code }) =>
      match(code)
        .returnType<SubscriptionFailureCause>()
        .with(SUBSCRIPTION_ERROR_CODE.NETWORK, () => 'network')
        .with(
          SUBSCRIPTION_ERROR_CODE.STORE_UNAVAILABLE,
          SUBSCRIPTION_ERROR_CODE.STORE_PROBLEM,
          SUBSCRIPTION_ERROR_CODE.OFFERINGS_UNAVAILABLE,
          () => 'store',
        )
        .with(SUBSCRIPTION_ERROR_CODE.PURCHASE_CANCELLED, () => 'purchaseCancelled')
        .with(SUBSCRIPTION_ERROR_CODE.PAYMENT_PENDING, () => 'paymentPending')
        .with(SUBSCRIPTION_ERROR_CODE.PURCHASE_FAILED, () => 'purchaseFailed')
        .with(SUBSCRIPTION_ERROR_CODE.RESTORE_FAILED, () => 'restoreFailed')
        .exhaustive(),
    )
    .with(P.instanceOf(NetworkError), P.instanceOf(TimeoutError), () => 'network')
    .otherwise(() => 'server');
}

/** 예상한 상태라 오류 경계로 보내지 않고 화면이 안내한다. setup은 설정 문제, temporary는 스토어 일시 장애다 */
export interface StoreUnavailable {
  kind: 'setup' | 'temporary';
  diagnosticCode: string;
}

export function findStoreUnavailableKind(error: unknown): StoreUnavailable['kind'] | null {
  return match(error)
    .returnType<StoreUnavailable['kind'] | null>()
    .with(
      P.instanceOf(SubscriptionError).and({ code: SUBSCRIPTION_ERROR_CODE.STORE_UNAVAILABLE }),
      () => 'setup',
    )
    .with(
      P.instanceOf(SubscriptionError).and({ code: SUBSCRIPTION_ERROR_CODE.STORE_PROBLEM }),
      () => 'temporary',
    )
    .otherwise(() => null);
}

/** 스토어 사용 불가 안내를 보였을 때 남길 신호. 개발 빌드는 Test Store라 로그만, 배포 빌드의 설정 문제는 매출이 막혀 error, 일시 장애는 warning 이벤트다 */
export type StoreUnavailableReport =
  | { channel: 'log' }
  | { channel: 'event'; severity: 'error' | 'warning' };

export function getStoreUnavailableReport(
  kind: StoreUnavailable['kind'],
  { isDebugBuild }: { isDebugBuild: boolean },
): StoreUnavailableReport {
  if (isDebugBuild) {
    return { channel: 'log' };
  }
  return match(kind)
    .returnType<StoreUnavailableReport>()
    .with('setup', () => ({ channel: 'event', severity: 'error' }))
    .with('temporary', () => ({ channel: 'event', severity: 'warning' }))
    .exhaustive();
}
