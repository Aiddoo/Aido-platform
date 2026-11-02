/**
 * unknown 에러를 로그용 메시지 문자열로 정규화
 *
 * catch 블록의 `error instanceof Error ? error.message : String(error)`
 * 반복을 대체한다.
 */
export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 로그 `errorType` 필드용. 원문 message 대신 Error 이름만 남긴다. */
export function toErrorType(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}
