// Base Classes
export { ApiError, isApiError } from '@src/core/errors/api-error';
export { BusinessError } from './business-error';

// Boundary 에러 분류 (라우트 ErrorBoundary 처리 분기)
export { type BoundaryErrorKind, classifyBoundaryError } from './classify-boundary-error';

// Sentry 전송 방식 판정 (이슈 / breadcrumb)
export { classifyErrorReport, type ErrorReportKind } from './classify-error-report';

// Infrastructure Errors
export {
  InfraError,
  isConnectivityError,
  isInfraError,
  NetworkError,
  ParseError,
  ServerError,
  TimeoutError,
} from './infra-error';

// Result Type
export {
  type CodedError,
  err,
  isBusinessError,
  isErr,
  isOk,
  ok,
  type Result,
  unwrap,
} from '@src/core/errors/result';

// Storage Errors
export { isKeychainLockedError, KeychainLockedError } from './storage-error';

// 던져진 값 정규화
export { getErrorMessage, toError } from './to-error';

// 사용자 노출 문구 판정
export { getUserFacingMessage } from './user-facing-message';
