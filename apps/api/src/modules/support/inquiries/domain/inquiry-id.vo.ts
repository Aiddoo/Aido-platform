import { randomUUID } from "node:crypto";

import { EntityId } from "#api/shared/domain/model/entity-id";

export class InquiryId extends EntityId<string> {
  static generate(): InquiryId {
    return new InquiryId(randomUUID());
  }

  static reconstitute(value: string): InquiryId {
    return new InquiryId(value);
  }
}
