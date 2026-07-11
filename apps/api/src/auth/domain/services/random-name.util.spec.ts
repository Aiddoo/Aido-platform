/**
 * generateRandomName 단위 테스트
 *
 * @description
 * 랜덤 이름 생성 유틸리티 함수를 검증한다.
 * 문자열 길이, 유일성, 공백 포함 여부를 확인한다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test random-name.util.spec.ts
 * ```
 */

import { generateRandomName } from "./random-name.util";

describe("generateRandomName", () => {
	it("비어있지 않은 문자열을 반환한다", () => {
		// Given - 별도 설정 없음

		// When
		const name = generateRandomName();

		// Then
		expect(name).toBeTruthy();
		expect(typeof name).toBe("string");
	});

	it("20자 이내의 이름을 반환한다", () => {
		// Given - 100회 반복 테스트

		// When & Then
		for (let i = 0; i < 100; i++) {
			const name = generateRandomName();
			expect(name.length).toBeLessThanOrEqual(20);
		}
	});

	it("여러 번 호출 시 다른 이름을 생성할 수 있다", () => {
		// Given
		const names = new Set<string>();

		// When
		for (let i = 0; i < 50; i++) {
			names.add(generateRandomName());
		}

		// Then
		expect(names.size).toBeGreaterThan(1);
	});

	it("공백을 포함한 이름을 반환한다", () => {
		// Given - 별도 설정 없음

		// When
		const name = generateRandomName();

		// Then
		expect(name).toContain(" ");
		expect(name.trim().length).toBeGreaterThan(0);
	});
});
