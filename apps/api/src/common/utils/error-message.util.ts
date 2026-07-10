/**
 * unknown 에러를 로그용 메시지 문자열로 정규화
 *
 * catch 블록의 `error instanceof Error ? error.message : String(error)`
 * 반복을 대체한다.
 */
export function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
