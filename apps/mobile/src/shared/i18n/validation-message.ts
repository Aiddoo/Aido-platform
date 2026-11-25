import {
  EMAIL_MAX_LENGTH,
  INQUIRY_CONTENT_LIMITS,
  PASSWORD_RULES,
  TODO_CATEGORY_LIMITS,
  TODO_COMMENT_LIMITS,
  TODO_LIMITS,
  USER_PROFILE_LIMITS,
  USER_REPORT_LIMITS,
  USER_TAG_LENGTH,
} from '@aido/api/vocabulary';
import type { FieldError } from 'react-hook-form';

import { tDynamic } from './index';

interface ValidationMessageKeys {
  /** 이슈 타입이 byType에 없을 때 사용할 validation 네임스페이스 키 */
  default: string;
  /** Zod 이슈 타입(too_small, too_big, invalid_format 등) → validation 네임스페이스 키 */
  byType?: Record<string, string>;
}

// 한도가 바뀌면 문구도 함께 바뀌도록 스키마와 같은 계약 상수를 {{count}}로 넘긴다
const VALIDATION_MESSAGE_COUNTS: Readonly<Record<string, number>> = {
  'email.tooLong': EMAIL_MAX_LENGTH,
  'password.tooShort': PASSWORD_RULES.MIN_LENGTH,
  'password.tooLong': PASSWORD_RULES.MAX_LENGTH,
  'password.pattern': PASSWORD_RULES.MIN_LENGTH,
  'nickname.tooLong': USER_PROFILE_LIMITS.NAME_MAX_LENGTH,
  'userTag.length': USER_TAG_LENGTH,
  'todoTitle.tooLong': TODO_LIMITS.TITLE_MAX_LENGTH,
  'categoryName.tooLong': TODO_CATEGORY_LIMITS.NAME_MAX_LENGTH,
  'inquiryContent.tooShort': INQUIRY_CONTENT_LIMITS.MIN_LENGTH,
  'inquiryContent.tooLong': INQUIRY_CONTENT_LIMITS.MAX_LENGTH,
  'comment.tooLong': TODO_COMMENT_LIMITS.CONTENT_MAX_LENGTH,
  'reportDetail.tooLong': USER_REPORT_LIMITS.MAX_DETAIL_LENGTH,
};

/** 스키마(서버 소유)의 message 문자열은 신뢰하지 않고 필드 에러의 존재·타입만 쓴다 */
export function resolveValidationMessage(
  error: FieldError | undefined,
  keys: ValidationMessageKeys,
): string | undefined {
  if (!error) {
    return undefined;
  }

  const key = keys.byType?.[error.type] ?? keys.default;
  return translateValidation(key, translateValidation(keys.default));
}

function translateValidation(key: string, defaultValue = ''): string {
  const count = VALIDATION_MESSAGE_COUNTS[key];
  return tDynamic('validation', key, defaultValue, count == null ? undefined : { count });
}
