// Base Classes
export { ApiError, isApiError } from './api-error';

// Boundary 에러 분류 (라우트 ErrorBoundary 처리 분기)
export { type BoundaryErrorKind, classifyBoundaryError } from './classify-boundary-error';

// Infrastructure Errors
export {
  InfraError,
  isInfraError,
  NetworkError,
  ParseError,
  ServerError,
  TimeoutError,
} from './infra-error';

// Result Type
export {
  type BusinessError,
  err,
  isBusinessError,
  isErr,
  isOk,
  ok,
  type Result,
  unwrap,
} from './result';

// Storage Errors
export { isKeychainLockedError, KeychainLockedError } from './storage-error';

// 던져진 값 정규화
export { errorMessageOf, toError } from './to-error';
