import { ErrorCode } from '@aido/api/errors';
import { type BusinessError, isApiError } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { match } from 'ts-pattern';

export const InviteErrorCode = {
  INVALID_CODE: 'INVITE_INVALID_CODE',
} as const;

export type InviteErrorCode = (typeof InviteErrorCode)[keyof typeof InviteErrorCode];

export class InviteError extends Error implements BusinessError {
  override readonly name = 'InviteError';

  constructor(
    public readonly code: InviteErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const InviteErrors = {
  invalidCode: () => new InviteError(InviteErrorCode.INVALID_CODE, t('invite:errors.invalidCode')),
} as const;

export const isInviteError = (error: unknown): error is InviteError => error instanceof InviteError;

/** 서버 플래그로 친구 초대가 꺼져 있다(INVITE_2105). 재시도 대신 쓸 수 없음 안내를 보인다 */
export const isInviteDisabledError = (error: unknown) =>
  isApiError(error) && error.hasCode(ErrorCode.INVITE_2105);

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
  if (isInviteError(error)) {
    return match(error.code)
      .with(InviteErrorCode.INVALID_CODE, () => 'invalid_code' as const)
      .exhaustive();
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
