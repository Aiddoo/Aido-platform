import type { BusinessError } from '@src/shared/errors';

export const MemoErrorCode = {
  CONTENT_EMPTY: 'MEMO_CONTENT_EMPTY',
  LIMIT_EXCEEDED: 'MEMO_LIMIT_EXCEEDED',
} as const;

export type MemoErrorCode = (typeof MemoErrorCode)[keyof typeof MemoErrorCode];

export class MemoError extends Error implements BusinessError {
  override readonly name = 'MemoError';

  constructor(
    public readonly code: MemoErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const MemoErrors = {
  contentEmpty: () => new MemoError(MemoErrorCode.CONTENT_EMPTY, '메모 내용을 입력해주세요'),
  limitExceeded: () => new MemoError(MemoErrorCode.LIMIT_EXCEEDED, '메모 개수가 한도에 도달했어요'),
} as const;

export const isMemoError = (error: unknown): error is MemoError => error instanceof MemoError;
