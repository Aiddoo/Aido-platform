import { ClientError } from '@src/shared/errors';

// ============================================
// Friend 도메인 에러 (클라이언트 검증용)
// ============================================

/** Friend 도메인 기본 에러 */
export class FriendError extends ClientError {
  override readonly name: string = 'FriendError';
  readonly code: string = 'FRIEND_ERROR';

  constructor(message: string = '친구 기능에 실패했어요') {
    super(message);
  }
}

/** 응답 검증 실패 */
export class FriendValidationError extends FriendError {
  override readonly name = 'FriendValidationError';
  override readonly code = 'FRIEND_VALIDATION';

  constructor() {
    super('잘못된 응답 형식이에요');
  }
}

/** 태그 형식 오류 */
export class InvalidTagError extends FriendError {
  override readonly name = 'InvalidTagError';
  override readonly code = 'INVALID_TAG';

  constructor() {
    super('올바른 태그 형식이 아니에요');
  }
}

// 타입 가드
export const isFriendError = (error: unknown): error is FriendError => error instanceof FriendError;
