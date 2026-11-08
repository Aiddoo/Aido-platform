import { isCodedError } from '@src/core/errors/result';
import { tDynamic } from '@src/shared/i18n';

import { BusinessError } from './business-error';
import { isInfraError, ParseError } from './infra-error';

/** ParseError는 개발자용 메시지라 undefined를 돌려 호출부가 폴백 문구를 쓰게 한다 */
export function getUserFacingMessage(error: unknown): string | undefined {
  if (error instanceof ParseError) {
    return undefined;
  }
  if (error instanceof BusinessError) {
    return tDynamic('errors', error.code) || undefined;
  }
  if (!isCodedError(error) && !isInfraError(error)) {
    return undefined;
  }

  return error.message.trim() ? error.message : undefined;
}
