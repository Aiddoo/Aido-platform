/**
 * ValueObject / EntityId 베이스 단위 테스트
 *
 * GWT 패턴 적용
 * - 값 기반 동등성, 타입 불일치, EntityId 문자열 변환 검증
 */

import { ValueObject } from "./value-object.base";
import { EntityId } from "./value-objects/entity-id.vo";

class TestStringVo extends ValueObject<string> {
	static create(value: string): TestStringVo {
		return new TestStringVo(value);
	}
}

class OtherStringVo extends ValueObject<string> {
	static create(value: string): OtherStringVo {
		return new OtherStringVo(value);
	}
}

class TestNumericId extends EntityId<number> {
	static create(value: number): TestNumericId {
		return new TestNumericId(value);
	}
}

describe("ValueObject — 값 객체 베이스", () => {
	it("같은 값을 가진 같은 타입의 VO는 동등하다", () => {
		// Given
		const a = TestStringVo.create("value");
		const b = TestStringVo.create("value");

		// When
		const result = a.equals(b);

		// Then
		expect(result).toBe(true);
	});

	it("다른 값을 가진 VO는 동등하지 않다", () => {
		// Given
		const a = TestStringVo.create("value-1");
		const b = TestStringVo.create("value-2");

		// When
		const result = a.equals(b);

		// Then
		expect(result).toBe(false);
	});

	it("값이 같아도 타입이 다르면 동등하지 않다", () => {
		// Given
		const a = TestStringVo.create("value");
		const b = OtherStringVo.create("value");

		// When
		const result = a.equals(b);

		// Then
		expect(result).toBe(false);
	});

	it("null/undefined와는 동등하지 않다", () => {
		// Given
		const a = TestStringVo.create("value");

		// When & Then
		expect(a.equals(null)).toBe(false);
		expect(a.equals(undefined)).toBe(false);
	});

	it("getValue로 원시 값을 꺼낼 수 있다", () => {
		// Given
		const vo = TestStringVo.create("raw-value");

		// When
		const value = vo.getValue();

		// Then
		expect(value).toBe("raw-value");
	});
});

describe("EntityId — 엔티티 식별자 베이스", () => {
	it("숫자 ID를 문자열로 변환할 수 있다", () => {
		// Given
		const id = TestNumericId.create(42);

		// When
		const result = id.toString();

		// Then
		expect(result).toBe("42");
	});

	it("같은 값의 ID는 동등하다", () => {
		// Given
		const a = TestNumericId.create(1);
		const b = TestNumericId.create(1);

		// When & Then
		expect(a.equals(b)).toBe(true);
	});
});
