import type { EntityId } from "./entity-id.js";

// 생성만 하는 Aggregate가 id를 저장·참조·전송하지 않으면 id 없이(null) 만든다
export type EntityIdentity = EntityId<string | number> | null;

export abstract class Entity<TId extends EntityIdentity, TProps extends object> {
  readonly id: TId;
  // 하위 클래스 전용 확장점이라 protected다. 그 밖의 비공개 멤버는 모두 #이다
  protected readonly props: TProps;

  protected constructor(id: TId, props: TProps) {
    this.id = id;
    this.props = props;
  }

  equals(other: Entity<TId, TProps>): boolean {
    if (this.id == null || other.id == null) {
      return other === this;
    }
    return other.constructor === this.constructor && other.id.equals(this.id);
  }
}
