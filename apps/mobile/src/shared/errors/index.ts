export { ApiError, isApiError } from '@src/core/errors/api-error';

export { classifyBoundaryError } from './classify-boundary-error';

export {
  isConnectivityError,
  isInfraError,
  NetworkError,
  ParseError,
  ServerError,
  TimeoutError,
} from './infra-error';

/** 코드를 가진 오류 타입. 오류 판별을 쓰는 곳을 위해 열어 둔다 @public */
export type { CodedError } from '@src/core/errors/result';

export { err, isBusinessError, ok, type Result, unwrap } from '@src/core/errors/result';

export { isKeychainLockedError, KeychainLockedError } from './storage-error';

export { getErrorMessage, toError } from './to-error';

export { getUserFacingMessage } from './user-facing-message';
