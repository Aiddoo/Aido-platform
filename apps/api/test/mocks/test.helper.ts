/**
 * 테스트용 헬퍼 함수 모음
 */

/**
 * 객체의 private 속성 값 가져오기
 *
 * @example
 * ```typescript
 * const resend = getPrivateProperty(emailService, '_resend');
 * ```
 */
export function getPrivateProperty<T>(instance: T, key: string): unknown {
	return (instance as Record<string, unknown>)[key];
}

/**
 * 객체의 private 속성 값 설정하기
 *
 * @example
 * ```typescript
 * setPrivateProperty(emailService, '_resend', mockResend);
 * ```
 */
export function setPrivateProperty<T>(
	instance: T,
	key: string,
	value: unknown,
): void {
	(instance as Record<string, unknown>)[key] = value;
}

/**
 * Mock 함수의 첫 번째 호출 결과 가져오기
 * non-null assertion 대신 사용
 *
 * @example
 * ```typescript
 * const result = getFirstCallResult<User>(mockCreate);
 * ```
 */
export function getFirstCallResult<T>(mock: jest.Mock): T {
	const result = mock.mock.results[0]?.value;
	if (result === undefined) {
		throw new Error("Mock이 호출되지 않았거나 undefined를 반환했습니다");
	}
	return result as T;
}

/**
 * Mock 함수의 첫 번째 호출 인자 가져오기
 *
 * @example
 * ```typescript
 * const [arg1, arg2] = getFirstCallArgs(mockCreate);
 * ```
 */
export function getFirstCallArgs(mock: jest.Mock): unknown[] {
	const args = mock.mock.calls[0];
	if (!args) {
		throw new Error("Mock이 호출되지 않았습니다");
	}
	return args;
}

/**
 * 특정 인덱스의 Mock 호출 결과 가져오기
 */
export function getNthCallResult<T>(mock: jest.Mock, index: number): T {
	const result = mock.mock.results[index]?.value;
	if (result === undefined) {
		throw new Error(
			`Mock의 ${index}번째 호출이 없거나 undefined를 반환했습니다`,
		);
	}
	return result as T;
}

/**
 * 특정 인덱스의 Mock 호출 인자 가져오기
 */
export function getNthCallArgs(mock: jest.Mock, index: number): unknown[] {
	const args = mock.mock.calls[index];
	if (!args) {
		throw new Error(`Mock의 ${index}번째 호출이 없습니다`);
	}
	return args;
}
