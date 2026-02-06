import type { BusinessError } from '@src/shared/errors';

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
  invalidTag: () => new FriendError(FriendErrorCode.INVALID_TAG, '올바른 태그 형식이 아니에요'),
  emptyTag: () => new FriendError(FriendErrorCode.EMPTY_TAG, '태그를 입력해주세요'),
} as const;

export const isFriendError = (error: unknown): error is FriendError => error instanceof FriendError;
