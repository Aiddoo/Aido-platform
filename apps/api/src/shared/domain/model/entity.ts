import type { EntityId } from "./entity-id.js";

export abstract class Entity<TId extends EntityId<string | number>, TProps extends object> {
  readonly id: TId;
  // 하위 클래스 전용 확장점이라 protected다. 그 밖의 비공개 멤버는 모두 #이다
  protected readonly props: TProps;

  protected constructor(id: TId, props: TProps) {
    this.id = id;
    this.props = props;
  }

  equals(other: Entity<TId, TProps>): boolean {
    return other.constructor === this.constructor && other.id.equals(this.id);
  }
}
