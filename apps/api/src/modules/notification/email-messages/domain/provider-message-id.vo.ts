import { EntityId } from "#api/shared/domain/model/entity-id";

// 메일 공급자가 접수한 메시지에 붙인 id다. 공급자 쪽 기록을 찾을 때만 쓴다
export class ProviderMessageId extends EntityId<string> {
  static reconstitute(value: string): ProviderMessageId {
    return new ProviderMessageId(value);
  }
}
