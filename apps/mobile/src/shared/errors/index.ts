export { ApiError, isApiError } from '@src/core/errors/api-error';

export { BusinessError } from './business-error';

export { classifyBoundaryError } from './classify-boundary-error';

export { getErrorReportTags, isUnexpectedError } from './classify-error-report';

export {
  isConnectivityError,
  isInfraError,
  NetworkError,
  ParseError,
  ServerError,
  TimeoutError,
} from './infra-error';

/** @public */
export type { CodedError } from '@src/core/errors/result';

export { err, isCodedError, ok, type Result, unwrap } from '@src/core/errors/result';

export { isKeychainLockedError, KeychainLockedError } from './storage-error';

export { getErrorMessage, toError } from './to-error';

export { getUserFacingMessage } from './user-facing-message';
