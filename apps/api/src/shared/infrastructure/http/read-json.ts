/**
 * 벤더 HTTP 응답 본문을 지정 타입으로 파싱한다.
 *
 * `Response.json()`은 `unknown`을 반환하므로, 외부 API 경계에서 단 한 번만
 * 타입 단정을 수행하는 지점을 여기(shared/infrastructure)로 격리한다.
 * 덕분에 클린아키 어댑터(no-cast 게이트 대상)는 캐스트 없이 유지된다.
 *
 * 런타임 형태 보증이 필요하면 호출부에서 별도 검증(zod 등)한다.
 */
export async function readJson<T>(response: Response): Promise<T> {
	return (await response.json()) as T;
}
