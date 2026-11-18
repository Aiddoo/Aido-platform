import { EntityId } from "#api/shared/domain/model/entity-id";

/** 로그인 공급자가 자기 계정에 붙인 ID(OAuth subject). 같은 공급자 안에서만 유일하다. */
export class ProviderAccountId extends EntityId<string> {
  static reconstitute(value: string): ProviderAccountId {
    return new ProviderAccountId(value);
  }
}
