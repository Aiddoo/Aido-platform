import { ValueObject } from "../value-object";

/**
 * 엔티티 식별자 VO 베이스
 *
 * 모듈별 ID VO(TodoId, UserId 등)의 공통 베이스입니다.
 * Aido는 cuid(string)와 autoincrement(number) ID가 혼재하므로 둘 다 지원합니다.
 */
export abstract class EntityId<TValue extends string | number> extends ValueObject<TValue> {
	override toString(): string {
		return String(this.value);
	}
}
