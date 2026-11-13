import { ErrorCode, type ErrorCodeType } from "./errors.js";

/** 서버가 보낸 문자열 code가 이 패키지가 아는 ErrorCode인지 본다. 새 서버가 더한 코드는 false다. */
export function isErrorCode(code: string): code is ErrorCodeType {
  return Object.hasOwn(ErrorCode, code);
}
