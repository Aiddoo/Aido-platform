// Base Classes
export { ApiError, isApiError } from './api-error';

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
