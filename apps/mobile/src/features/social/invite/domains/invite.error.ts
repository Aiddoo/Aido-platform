import { ErrorCode } from '@aido/api/errors';
import { isBusinessError } from '@src/core/errors/result';
import { type ApiError, isApiError } from '@src/shared/errors';
import { match } from 'ts-pattern';

export const INVITE_ERROR_CODE = {
  INVALID_CODE: 'INVITE_INVALID_CODE',
} as const;

export type InviteErrorCode = (typeof INVITE_ERROR_CODE)[keyof typeof INVITE_ERROR_CODE];

/** 서버 플래그로 친구 초대가 꺼져 있다(INVITE_2105). 재시도 대신 쓸 수 없음 안내를 보인다 */
export function isInviteDisabledError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.INVITE_2105);
}

/** 서버가 링크 새로 만들기를 거절했다. 이 실패는 토스트로 알리고 그 밖의 장애는 화면 오류 경계가 맡는다 */
export function isInviteRotateRejectedError(error: unknown): error is ApiError {
  return isApiError(error);
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
  if (isBusinessError(error, INVITE_ERROR_CODE.INVALID_CODE)) {
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

/**
 * 다시 열어도 결과가 같은 실패인지. 이어서 열 초대를 지울지 정한다.
 * 잠시 막힌 경우(초대 중지·친구 자리·장애)는 남겨 두어 다음 실행 때 다시 시도한다.
 */
export function isTerminalRedeemFailure(reason: RedeemFailureReason) {
  return match(reason)
    .with('invalid_code', 'not_found', 'rotated', 'self', 'already_redeemed', 'blocked', () => true)
    .with('disabled', 'friend_limit', 'unknown', () => false)
    .exhaustive();
}
