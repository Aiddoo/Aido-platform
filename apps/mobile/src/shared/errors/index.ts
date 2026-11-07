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

export { err, isBusinessError, ok, type Result, unwrap } from '@src/core/errors/result';

export { isKeychainLockedError, KeychainLockedError } from './storage-error';

export { getErrorMessage, toError } from './to-error';

export { getUserFacingMessage } from './user-facing-message';
