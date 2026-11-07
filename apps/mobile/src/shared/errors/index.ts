export { ApiError, isApiError } from '@src/core/errors/api-error';

// Boundary 에러 분류 (라우트 ErrorBoundary 처리 분기)
export { classifyBoundaryError } from './classify-boundary-error';

export {
  isConnectivityError,
  isInfraError,
  NetworkError,
  ParseError,
  ServerError,
  TimeoutError,
} from './infra-error';

export {
  type CodedError,
  err,
  isBusinessError,
  ok,
  type Result,
  unwrap,
} from '@src/core/errors/result';

export { isKeychainLockedError, KeychainLockedError } from './storage-error';

// 던져진 값 정규화
export { getErrorMessage, toError } from './to-error';

// 사용자 노출 문구 판정
export { getUserFacingMessage } from './user-facing-message';
