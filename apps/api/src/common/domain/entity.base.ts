/**
 * 도메인 엔티티 베이스
 *
 * 식별자를 가지지만 애그리게잇 루트가 아닌 엔티티의 베이스입니다.
 * (애그리게잇 루트는 aggregate-root.base.ts의 AggregateRoot를 사용)
 *
 * props는 하위 클래스에서만 접근하며 getter로만 노출합니다.
 */
export abstract class Entity<TProps> {
	protected constructor(protected readonly props: TProps) {}
}
