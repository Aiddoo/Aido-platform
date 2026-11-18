import { EntityId } from "#api/shared/domain/model/entity-id";

// 저장소 nextId()가 공개 계약의 c 접두사·25자 형식으로 만든다
export class BroadcastCampaignId extends EntityId<string> {
  static reconstitute(value: string): BroadcastCampaignId {
    return new BroadcastCampaignId(value);
  }
}
