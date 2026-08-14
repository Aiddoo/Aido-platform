/**
 * jose 라이브러리 벤더 경계 래퍼
 *
 * jose는 ESM-only 모듈이므로 동적 import를 사용한다. jose의 복잡한 제네릭
 * 타입과 애플리케이션이 필요로 하는 최소 시그니처 사이의 불일치(벤더 캐스트)를
 * 이 경계 한 곳으로 격리한다 — auth 인프라 어댑터는 no-cast를 유지한다.
 * (weather `readJson`·ai-report `toInputJson`과 동일한 벤더 경계 격리 패턴.)
 */

/** JWKS 함수 타입 (createRemoteJWKSet 반환값) */
export type JWKSFunction = (protectedHeader: unknown, token: unknown) => Promise<unknown>;

/** 애플리케이션에서 조정 가능한 최소 Remote JWKS 옵션 */
export interface RemoteJWKSetOptions {
	cooldownDuration?: number;
}

/** jose에서 필요한 함수만 노출하는 타입 안전 래퍼 */
export interface JoseWrapper {
	createRemoteJWKSet: (url: URL, options?: RemoteJWKSetOptions) => JWKSFunction;
	jwtVerify: <T>(
		jwt: string,
		jwks: JWKSFunction,
		options?: { issuer?: string; audience?: string },
	) => Promise<{ payload: T }>;
	isJWTExpiredError: (error: unknown) => boolean;
	isJWTClaimValidationError: (error: unknown) => boolean;
}

/** jose를 동적 import 하여 타입 안전 래퍼로 감싼다. */
export async function loadJose(): Promise<JoseWrapper> {
	const jose = await import("jose");
	return {
		createRemoteJWKSet: (url: URL, options?: RemoteJWKSetOptions) =>
			jose.createRemoteJWKSet(url, options) as JWKSFunction,
		jwtVerify: <T>(
			jwt: string,
			jwks: JWKSFunction,
			options?: { issuer?: string; audience?: string },
		) =>
			jose.jwtVerify(jwt, jwks as Parameters<typeof jose.jwtVerify>[1], options) as Promise<{
				payload: T;
			}>,
		isJWTExpiredError: (error: unknown): boolean => error instanceof jose.errors.JWTExpired,
		isJWTClaimValidationError: (error: unknown): boolean =>
			error instanceof jose.errors.JWTClaimValidationFailed,
	};
}
