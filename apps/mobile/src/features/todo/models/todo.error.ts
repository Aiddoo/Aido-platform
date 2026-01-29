import { ClientError } from '@src/shared/errors';

// ============================================
// Todo 도메인 에러 (클라이언트 검증용)
// ============================================

/** Todo 도메인 기본 에러 */
export class TodoError extends ClientError {
  override readonly name: string = 'TodoError';
  readonly code: string = 'TODO_ERROR';

  constructor(message: string = '할 일 기능에 실패했어요') {
    super(message);
  }
}

/** 응답 검증 실패 */
export class TodoValidationError extends TodoError {
  override readonly name = 'TodoValidationError';
  override readonly code = 'TODO_VALIDATION';

  constructor() {
    super('잘못된 응답 형식이에요');
  }
}

// 타입 가드
export const isTodoError = (error: unknown): error is TodoError => error instanceof TodoError;
