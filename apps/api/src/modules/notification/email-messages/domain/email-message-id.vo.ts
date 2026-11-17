import { randomUUID } from "node:crypto";

import { EntityId } from "#api/shared/domain/model/entity-id";

// 발송 건 id다. 큐 작업 key와 공급자 멱등 키로 쓴다
export class EmailMessageId extends EntityId<string> {
  static generate(): EmailMessageId {
    return new EmailMessageId(randomUUID());
  }

  static reconstitute(value: string): EmailMessageId {
    return new EmailMessageId(value);
  }
}
