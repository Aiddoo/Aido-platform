import { ErrorCode } from '@aido/api/errors';
import { isCodedError } from '@src/core/errors/result';
import { isApiError } from '@src/shared/errors';
import { match } from 'ts-pattern';

export const INVITE_ERROR_CODE = {
  INVALID_CODE: 'INVITE_INVALID_CODE',
} as const;

export type InviteErrorCode = (typeof INVITE_ERROR_CODE)[keyof typeof INVITE_ERROR_CODE];

/** 서버가 코드로 거절한 초대 코드(없음·바뀜·내 코드 등). 같은 화면에서 다시 입력하게 코드 칸에 보인다 */
export function isInviteCodeFieldError(error: unknown) {
  return isCodedError(error);
}

/** 서버·앱이 코드로 거절한 수락 실패. 연결·서버 장애는 빼고 이유를 분석에 남긴다 */
export function isRedeemRejectedError(error: unknown) {
  return isCodedError(error);
}

/** 서버 플래그로 친구 초대가 꺼져 있다(INVITE_2105). 재시도 대신 쓸 수 없음 안내를 보인다 */
export function isInviteDisabledError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.INVITE_2105);
}

/** 초대 수락이 실패한 이유. 분석 이벤트 invite_redeem_failed.reason이 이 값을 그대로 쓴다 */
export type RedeemFailureReason =
  | 'invalid_code'
  | 'not_found'
  | 'rotated'
  | 'self'
  | 'already_redeemed'
  | 'disabled'
  | 'friend_limit'
  | 'blocked'
  | 'unknown';

export function toRedeemFailureReason(error: unknown): RedeemFailureReason {
  if (isCodedError(error, INVITE_ERROR_CODE.INVALID_CODE)) {
    return 'invalid_code';
  }
  if (!isApiError(error)) {
    return 'unknown';
  }

  return match(error.code)
    .with(ErrorCode.INVITE_2101, () => 'not_found' as const)
    .with(ErrorCode.INVITE_2102, () => 'rotated' as const)
    .with(ErrorCode.INVITE_2103, () => 'self' as const)
    .with(ErrorCode.INVITE_2104, () => 'already_redeemed' as const)
    .with(ErrorCode.INVITE_2105, () => 'disabled' as const)
    .with(ErrorCode.INVITE_2106, () => 'friend_limit' as const)
    .with(ErrorCode.BLOCK_2204, () => 'blocked' as const)
    .otherwise(() => 'unknown' as const);
}

/** 다시 열어도 결과가 같은 실패인지. 같으면 이어서 열 초대를 지우고, 잠시 막힌 경우(초대 중지·친구 자리·장애)는 지우지 않는다 */
export function isTerminalRedeemFailure(reason: RedeemFailureReason) {
  return match(reason)
    .with('invalid_code', 'not_found', 'rotated', 'self', 'already_redeemed', 'blocked', () => true)
    .with('disabled', 'friend_limit', 'unknown', () => false)
    .exhaustive();
}
