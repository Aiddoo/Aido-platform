import { ApiError, NetworkError, ParseError, ServerError, TimeoutError } from '@src/shared/errors';
import { match, P } from 'ts-pattern';

import { SubscriptionError } from '../domains/subscription.error';

export function getDiagnosticCode(error: unknown): string {
  return match(error)
    .with(P.instanceOf(SubscriptionError), ({ code, storeErrorCode }) =>
      storeErrorCode == null ? code : `${code} (${storeErrorCode})`,
    )
    .with(P.instanceOf(ApiError), ({ code }) => code)
    .with(P.instanceOf(NetworkError), () => 'NETWORK')
    .with(P.instanceOf(TimeoutError), () => 'TIMEOUT')
    .with(P.instanceOf(ServerError), ({ statusCode }) => `SERVER_${statusCode}`)
    .with(P.instanceOf(ParseError), () => 'INVALID_RESPONSE')
    .otherwise(() => 'UNKNOWN');
}
