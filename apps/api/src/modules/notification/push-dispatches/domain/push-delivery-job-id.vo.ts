import { EntityId } from "#api/shared/domain/model/entity-id";

// 발송을 담당한 큐 작업 id다. 늦은 worker가 결과를 덮지 못하게 fence로 쓴다
export class PushDeliveryJobId extends EntityId<string> {
  static reconstitute(value: string): PushDeliveryJobId {
    return new PushDeliveryJobId(value);
  }
}
