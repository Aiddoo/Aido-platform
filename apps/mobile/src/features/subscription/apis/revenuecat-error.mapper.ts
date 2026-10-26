import { PURCHASES_ERROR_CODE } from 'react-native-purchases';
import { match, P } from 'ts-pattern';
import { z } from 'zod';

import { type SubscriptionError, SubscriptionErrors } from '../domains/subscription.error';

/** 스토어 SDK를 부른 작업. 같은 SDK 코드라도 작업마다 사용자에게 뜻하는 바가 다르다 */
export type StoreOperation = 'offerings' | 'purchase' | 'restore';

const storeErrorCodeSchema = z.enum(PURCHASES_ERROR_CODE);

/** SDK가 던진 값에서 `PURCHASES_ERROR_CODE`를 읽는다. SDK 오류가 아니면 null이다 */
function toStoreErrorCode(error: unknown) {
  if (typeof error !== 'object' || error == null || !('code' in error)) {
    return null;
  }
  const parsed = storeErrorCodeSchema.safeParse(error.code);
  return parsed.success ? parsed.data : null;
}

const NETWORK_CODES = [
  PURCHASES_ERROR_CODE.NETWORK_ERROR,
  PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR,
  PURCHASES_ERROR_CODE.PRODUCT_REQUEST_TIMED_OUT_ERROR,
  PURCHASES_ERROR_CODE.API_ENDPOINT_BLOCKED,
] as const;

const STORE_SETUP_CODES = [
  PURCHASES_ERROR_CODE.CONFIGURATION_ERROR,
  PURCHASES_ERROR_CODE.INVALID_CREDENTIALS_ERROR,
  PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR,
  PURCHASES_ERROR_CODE.UNSUPPORTED_ERROR,
] as const;

/** RevenueCat SDK 오류를 도메인 오류로 바꾼다. 화면은 SDK 코드를 모른다 */
export function toSubscriptionError(operation: StoreOperation, error: unknown): SubscriptionError {
  const storeErrorCode = toStoreErrorCode(error);

  return match({ operation, storeErrorCode })
    .with({ storeErrorCode: P.union(...NETWORK_CODES) }, () =>
      SubscriptionErrors.network(storeErrorCode),
    )
    .with(
      { operation: 'purchase', storeErrorCode: PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR },
      () => SubscriptionErrors.purchaseCancelled(storeErrorCode),
    )
    .with(
      { operation: 'purchase', storeErrorCode: PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR },
      () => SubscriptionErrors.paymentPending(storeErrorCode),
    )
    .with({ operation: 'offerings', storeErrorCode: P.union(...STORE_SETUP_CODES) }, () =>
      SubscriptionErrors.storeUnavailable(storeErrorCode),
    )
    .with({ operation: 'offerings' }, () => SubscriptionErrors.offeringsUnavailable(storeErrorCode))
    .with({ operation: 'purchase' }, () => SubscriptionErrors.purchaseFailed(storeErrorCode))
    .with({ operation: 'restore' }, () => SubscriptionErrors.restoreFailed(storeErrorCode))
    .exhaustive();
}
