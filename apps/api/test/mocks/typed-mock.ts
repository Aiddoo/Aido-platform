/**
 * 협력자(collaborator) 부분 목 헬퍼.
 *
 * 일부 메서드만 구현한 부분 객체를 완전한 `jest.Mocked<T>`로 좁힌다. 실제
 * 유스케이스에 위임하는 서비스 스펙에서, 유스케이스의 협력자를 최소 목으로 배선할 때
 * 사용한다. 캐스트를 spec(=no-cast 스캔 대상) 밖 test/ 로 격리하기 위한 헬퍼다.
 *
 * @example
 *   const sessionService = mockOf<SessionService>({ createSessionWithTokens: jest.fn() });
 */
export function mockOf<T extends object>(
	impl: Partial<jest.Mocked<T>> = {},
): jest.Mocked<T> {
	return impl as jest.Mocked<T>;
}

/**
 * @suites `Mocked<T>`(unitRef.get 반환) 목을 실제 `T` 파라미터 위치에 전달하기 위한
 * 캐스트 격리 헬퍼. @suites Mocked<T>는 구조적으로 T에 대입 불가하므로, 실제
 * 유스케이스/협력자 생성자에 목을 주입할 때 이 헬퍼로 좁힌다(캐스트를 test/ 로 격리).
 *
 * @example
 *   new IssueLoginUseCase(asDep(sessionService), asDep(userRepo));
 */
export function asDep<T>(mock: unknown): T {
	return mock as T;
}
