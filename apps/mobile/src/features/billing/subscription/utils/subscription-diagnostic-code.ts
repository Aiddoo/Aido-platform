import {
  isApiError,
  NetworkError,
  ParseError,
  ServerError,
  TimeoutError,
} from '@src/shared/errors';
import { match, P } from 'ts-pattern';

import { SubscriptionError } from '../domains/subscription.error';

/**
 * 문의에 붙일 짧은 오류 코드. 메시지·사용자 정보 없이 원인을 찾을 만큼만 담는다.
 * 스토어 SDK 코드가 있으면 괄호로 덧붙인다.
 */
export function getDiagnosticCode(error: unknown): string {
  return match(error)
    .with(P.instanceOf(SubscriptionError), ({ code, storeErrorCode }) =>
      storeErrorCode == null ? code : `${code} (${storeErrorCode})`,
    )
    .with(P.when(isApiError), ({ code }) => code)
    .with(P.instanceOf(NetworkError), () => 'NETWORK')
    .with(P.instanceOf(TimeoutError), () => 'TIMEOUT')
    .with(P.instanceOf(ServerError), ({ statusCode }) => `SERVER_${statusCode}`)
    .with(P.instanceOf(ParseError), () => 'INVALID_RESPONSE')
    .otherwise(() => 'UNKNOWN');
}
