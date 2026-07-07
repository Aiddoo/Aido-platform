import type { FieldError } from 'react-hook-form';
import { tDynamic } from './index';

interface ValidationMessageKeys {
  /** 이슈 타입이 byType에 없을 때 사용할 validation 네임스페이스 키 */
  default: string;
  /** Zod 이슈 타입(too_small, too_big, invalid_format 등) → validation 네임스페이스 키 */
  byType?: Record<string, string>;
}

/**
 * `@aido/validators` 공유 스키마(서버 소유, 한국어 message)를 쓰는 폼의
 * 에러 표시를 로케일 키로 매핑한다. 스키마의 message 문자열은 신뢰하지 않고
 * 필드 에러의 존재/타입만 사용한다.
 *
 * @example
 * errorMessage={resolveValidationMessage(errors.email, {
 *   default: 'email.invalid',
 *   byType: { too_big: 'email.tooLong' },
 * })}
 */
export const resolveValidationMessage = (
  error: FieldError | undefined,
  keys: ValidationMessageKeys,
): string | undefined => {
  if (!error) {
    return undefined;
  }

  const key = keys.byType?.[error.type] ?? keys.default;
  return tDynamic('validation', key, tDynamic('validation', keys.default));
};
