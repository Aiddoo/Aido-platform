import type { BusinessError } from '@src/shared/errors';
import { t } from '@src/shared/i18n';

export const FriendErrorCode = {
  INVALID_TAG: 'FRIEND_INVALID_TAG',
  EMPTY_TAG: 'FRIEND_EMPTY_TAG',
} as const;

export type FriendErrorCode = (typeof FriendErrorCode)[keyof typeof FriendErrorCode];

export class FriendError extends Error implements BusinessError {
  override readonly name = 'FriendError';

  constructor(
    public readonly code: FriendErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const FriendErrors = {
  invalidTag: () => new FriendError(FriendErrorCode.INVALID_TAG, t('friend:errors.invalidTag')),
  emptyTag: () => new FriendError(FriendErrorCode.EMPTY_TAG, t('friend:errors.emptyTag')),
} as const;

export const isFriendError = (error: unknown): error is FriendError => error instanceof FriendError;
