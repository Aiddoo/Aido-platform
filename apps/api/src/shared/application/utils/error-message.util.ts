/** 로그 `errorType` 필드용. 원문 message 대신 Error 이름만 남긴다. */
export function toErrorType(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}
