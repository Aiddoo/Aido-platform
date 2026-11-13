export { ApiError, isApiError } from '@src/core/errors/api-error';

export { BusinessError } from './business-error';

export { classifyError } from './classify-error';

export { getErrorDiagnosis } from './error-diagnosis';

export {
  isConnectivityError,
  isTransientError,
  NetworkError,
  ParseError,
  ServerError,
  TimeoutError,
} from './infra-error';

export { getErrorReportTags, reportUnexpectedError } from './report-unexpected-error';

/** @public */
export type { CodedError } from '@src/core/errors/result';

export { err, isCodedError, ok, type Result, unwrap } from '@src/core/errors/result';

export { isKeychainLockedError, KeychainLockedError } from './storage-error';

export { getErrorMessage, toError } from './to-error';

export { getUserFacingMessage } from './user-facing-message';
