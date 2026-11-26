import { ErrorCode } from '@aido/api/errors';
import { isCodedError } from '@src/core/errors/result';
import { getUserFacingMessage, isApiError } from '@src/shared/errors';
import { match } from 'ts-pattern';

export const INVITE_ERROR_CODE = {
  INVALID_CODE: 'INVITE_INVALID_CODE',
} as const;

export type InviteErrorCode = (typeof INVITE_ERROR_CODE)[keyof typeof INVITE_ERROR_CODE];

/** 코드 자체가 틀린 거절(없음·바뀜·내 코드·이미 다른 초대 수락). 초대 꺼짐(2105)·친구 한도(2106)·요청 과다는 칸 오류가 아니다 */
const INVITE_CODE_FIELD_ERROR_CODES = [
  ErrorCode.INVITE_2101,
  ErrorCode.INVITE_2102,
  ErrorCode.INVITE_2103,
  ErrorCode.INVITE_2104,
] as const;

/** 같은 화면에서 다시 입력하게 코드 칸에 보일 오류. 형식이 틀린 코드(앱 판단)도 포함한다 */
export function isInviteCodeFieldError(error: unknown) {
  return (
    isCodedError(error, INVITE_ERROR_CODE.INVALID_CODE) ||
    (isApiError(error) && INVITE_CODE_FIELD_ERROR_CODES.some((code) => error.hasCode(code)))
  );
}

/** 오프라인이라 보내 보지 않은 코드 확인. 안내는 확인 mutation이 하고, 폼에는 실패로 남아 다시 누를 수 있다 */
export class InviteCodeNotCheckedOfflineError extends Error {
  constructor() {
    super('invite code: not checked while offline');
    this.name = 'InviteCodeNotCheckedOfflineError';
  }
}

export function isInviteCodeNotCheckedOfflineError(error: unknown) {
  return error instanceof InviteCodeNotCheckedOfflineError;
}

/** 서버가 거절한 코드의 칸 오류 type. 형식 오류(Zod 이슈)와 문구 출처가 달라 서버 문구를 싣는다 */
export const INVITE_CODE_SERVER_ERROR_TYPE = 'server';

/** 코드 칸(inviteCode)에 보일 서버 거절. 연결·서버 장애처럼 칸에 속하지 않으면 null이다 */
export function findInviteCodeFieldError(error: unknown) {
  if (!isInviteCodeFieldError(error)) {
    return null;
  }

  return { type: INVITE_CODE_SERVER_ERROR_TYPE, message: getUserFacingMessage(error) ?? undefined };
}

/** 이유를 아는 수락 거절(아래 표). 연결·서버 장애·모르는 코드는 빼고 이유를 분석에 남긴다 */
export function isRedeemRejectedError(error: unknown) {
  return getRedeemFailure(error) !== 'unknown';
}

/** 서버 플래그로 친구 초대가 꺼져 있다(INVITE_2105). 재시도 대신 쓸 수 없음 안내를 보인다 */
export function isInviteDisabledError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.INVITE_2105);
}

/** 초대 수락이 실패한 이유. 분석 이벤트 invite_redeem_failed.reason이 이 값을 그대로 쓴다 */
export type RedeemFailure =
  | 'invalid_code'
  | 'not_found'
  | 'rotated'
  | 'self'
  | 'already_redeemed'
  | 'disabled'
  | 'friend_limit'
  | 'blocked'
  | 'unknown';

export function getRedeemFailure(error: unknown): RedeemFailure {
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
export function isTerminalRedeemFailure(reason: RedeemFailure) {
  return match(reason)
    .with('invalid_code', 'not_found', 'rotated', 'self', 'already_redeemed', 'blocked', () => true)
    .with('disabled', 'friend_limit', 'unknown', () => false)
    .exhaustive();
}
