/**
 * 값 객체(Value Object) 베이스
 *
 * 식별자 없이 값으로만 동등성을 판단하는 불변 객체입니다.
 * 하위 클래스는 정적 팩토리(`create`)에서 불변식을 검증하고
 * 위반 시 DomainException을 던집니다.
 */
export abstract class ValueObject<TValue> {
	protected constructor(protected readonly value: TValue) {
		// 생성 시점에 검증된 값이 사후 변조로 불변식을 깨지 못하도록 동결
		// (얕은 동결 — 내부 Date 등 가변 참조는 하위 클래스 getter가 방어 복사)
		if (typeof value === "object" && value !== null) {
			Object.freeze(value);
		}
	}

	getValue(): TValue {
		return this.value;
	}

	equals(other?: ValueObject<TValue> | null): boolean {
		if (other === null || other === undefined) {
			return false;
		}
		if (other.constructor !== this.constructor) {
			return false;
		}
		return JSON.stringify(this.value) === JSON.stringify(other.value);
	}
}
