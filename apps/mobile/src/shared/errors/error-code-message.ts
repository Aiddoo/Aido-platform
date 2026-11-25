import { ErrorCode } from '@aido/api/errors';
import {
  CHEER_LIMITS,
  INVITE_CODE,
  NUDGE_LIMITS,
  REMIND_NUDGE_LIMITS,
  USER_SEARCH_QUERY_LENGTH,
  VERIFICATION_CODE,
} from '@aido/api/vocabulary';
import { MINUTE_MS, SECOND_MS } from '@src/shared/constants/time-units';
import { tDynamic } from '@src/shared/i18n';

// 한도·대기 시간이 바뀌면 문구도 함께 바뀌도록 서버와 같은 계약 상수를 {{count}}로 넘긴다. 앱 코드는 카탈로그 키 그대로다
const ERROR_MESSAGE_COUNTS: Readonly<Record<string, number>> = {
  [ErrorCode.VERIFY_0753]: (VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS * SECOND_MS) / MINUTE_MS,
  [ErrorCode.CHEER_1202]: CHEER_LIMITS.COOLDOWN_HOURS,
  [ErrorCode.NUDGE_1108]: REMIND_NUDGE_LIMITS.COOLDOWN_HOURS,
  TODO_NUDGE_MESSAGE_TOO_LONG: NUDGE_LIMITS.MAX_MESSAGE_LENGTH,
  INVITE_INVALID_CODE: INVITE_CODE.LENGTH,
  FRIEND_SEARCH_QUERY_TOO_SHORT: USER_SEARCH_QUERY_LENGTH.MIN,
};

/** `errors` 카탈로그에서 코드의 사용자 문구를 찾는다. 서버 `ErrorCode`와 앱 코드가 같은 카탈로그를 쓴다 */
export function findErrorCodeMessage(code: string): string | null {
  const count = ERROR_MESSAGE_COUNTS[code];
  return tDynamic('errors', code, '', count == null ? undefined : { count }) || null;
}
