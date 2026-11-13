import { EntityId } from "#api/shared/domain/model/entity-id";

// 기기 ID·이메일 원문 대신 남기는 64자 해시가 식별자다
export class RewardClaimId extends EntityId<string> {
  static reconstitute(value: string): RewardClaimId {
    return new RewardClaimId(value);
  }
}
