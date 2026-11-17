import { EntityId } from "#api/shared/domain/model/entity-id";

// 공급자가 수락한 발송 하나를 receipt로 다시 찾는 id다
export class PushTicketId extends EntityId<string> {
  static reconstitute(value: string): PushTicketId {
    return new PushTicketId(value);
  }
}
